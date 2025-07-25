import persist from 'node-persist';
import { CoralApiInterface } from '../api/coral.js';
import { CurrentUser, Friend, Presence, PresenceState, CoralError, PresenceGame } from '../api/coral-types.js';
import { ErrorResponse } from '../api/util.js';
import { SavedToken } from './auth/coral.js';
import { SplatNet2RecordsMonitor } from './splatnet2/monitor.js';
import createDebug from '../util/debug.js';
import Loop, { LoopResult } from '../util/loop.js';
import { getTitleIdFromEcUrl, hrduration } from '../util/misc.js';
import { handleError } from '../util/errors.js';
import { CoralUser } from './users.js';

const debug = createDebug('nxapi:nso:notify');
const debugFriends = createDebug('nxapi:nso:notify:friends');
const debugSplatnet2 = createDebug('nxapi:nso:notify:splatnet2-monitor');

export class ZncNotifications extends Loop {
    notifications = new NotificationManager();
    splatnet2_monitors = new Map<string, EmbeddedSplatNet2Monitor | (() => Promise<EmbeddedSplatNet2Monitor>)>();

    user_notifications = true;
    friend_notifications = true;
    update_interval = 30;

    constructor(
        public user: CoralUser<CoralApiInterface>,
    ) {
        super();
    }

    async init() {
        await this.update();

        return LoopResult.OK;
    }

    async updateFriendsStatusForNotifications(
        friends: (CurrentUser | Friend)[],
        naid = this.user.data.user.id,
        initialRun?: boolean
    ) {
        this.notifications.updateFriendsStatusForNotifications(friends, naid, initialRun);
    }

    async updatePresenceForNotifications(
        user: CurrentUser | null, friends: Friend[] | null,
        naid = this.user.data.user.id, initialRun?: boolean
    ) {
        await this.updateFriendsStatusForNotifications(([] as (CurrentUser | Friend)[])
            .concat(this.user_notifications && user ? [user] : [])
            .concat(this.friend_notifications && friends ? friends : []), naid, initialRun);
    }

    async updatePresenceForSplatNet2Monitors(friends: (CurrentUser | Friend)[]) {
        for (const friend of friends) {
            await this.updatePresenceForSplatNet2Monitor(friend.presence, friend.nsaId, friend.name);
        }
    }

    async updatePresenceForSplatNet2Monitor(presence: Presence, nsa_id: string, name?: string) {
        const playing = presence.state === PresenceState.PLAYING;
        const monitor = this.splatnet2_monitors.get(nsa_id);

        if (playing && monitor) {
            const currenttitle = presence.game as PresenceGame;
            const titleid = getTitleIdFromEcUrl(currenttitle.shopUri);

            if (titleid && EmbeddedSplatNet2Monitor.title_ids.includes(titleid)) {
                if ('enable' in monitor) {
                    monitor.enable();
                    if (!monitor.enabled) debugSplatnet2('Started monitor for user %s', name ?? nsa_id);
                } else {
                    const m = await monitor.call(null);
                    this.splatnet2_monitors.set(nsa_id, m);
                    m.enable();
                    debugSplatnet2('Started monitor for user %s', name ?? nsa_id);
                }
            } else if ('disable' in monitor) {
                if (monitor.enabled) debugSplatnet2('Stopping monitor for user %s', name ?? nsa_id);
                monitor.disable();
            }
        } else if (monitor && 'disable' in monitor) {
            if (monitor.enabled) debugSplatnet2('Stopping monitor for user %s', name ?? nsa_id);
            monitor.disable();
        }
    }

    async update() {
        const [user, friends] = await Promise.all([
            this.user_notifications || this.splatnet2_monitors.size ? this.user.getCurrentUser() : null,
            this.friend_notifications ? this.user.getFriends() : null,
        ]);

        await this.updatePresenceForNotifications(user, friends, this.user.data.user.id, false);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    async handleError(err: ErrorResponse<CoralError> | NodeJS.ErrnoException): Promise<LoopResult> {
        return handleError(err, this);
    }
}

export class NotificationManager {
    onPresenceUpdated?(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, type?: PresenceEvent, naid?: string, ir?: boolean): void;

    onFriendOnline?(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean): void;
    onFriendOffline?(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean): void;
    onFriendPlayingChangeTitle?(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean): void;
    onFriendTitleStateChange?(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean): void;

    onlinefriends = new Map</** NA ID */ string, (CurrentUser | Friend)[]>();
    accounts = new Map</** NSA ID */ string, /** NA ID */ string>();

    updateFriendsStatusForNotifications(friends: (CurrentUser | Friend)[], naid: string, initialRun?: boolean) {
        const newonlinefriends: (CurrentUser | Friend)[] = [];

        for (const friend of friends) {
            const prev = this.onlinefriends.get(naid)?.find(f => f.nsaId === friend.nsaId);
            const lastpresence = prev?.presence;
            const online = friend.presence.state === PresenceState.ONLINE ||
                friend.presence.state === PresenceState.PLAYING;
            const wasonline = lastpresence?.state === PresenceState.ONLINE ||
                lastpresence?.state === PresenceState.PLAYING;
            const consolewasonline = wasonline ||
                lastpresence?.state === PresenceState.INACTIVE;

            if (friend.presence.state !== PresenceState.OFFLINE || friend.presence.updatedAt) {
                if (!this.accounts.has(friend.nsaId)) {
                    this.accounts.set(friend.nsaId, naid);
                }
            }

            newonlinefriends.push(friend);

            // Another account is monitoring this user's presence
            if (this.accounts.get(friend.nsaId) !== naid) continue;

            if (lastpresence?.updatedAt !== friend.presence.updatedAt && !initialRun) {
                debugFriends('%s\'s presence updated', friend.name,
                    new Date(friend.presence.updatedAt * 1000).toString());
            }

            let type: PresenceEvent | undefined = undefined;
            let callback: 'onFriendOnline' | 'onFriendOffline' | 'onFriendPlayingChangeTitle' |
                'onFriendTitleStateChange' | undefined = undefined;

            if (!wasonline && online) {
                // Friend has come online
                type = PresenceEvent.STATE_CHANGE;
                callback = 'onFriendOnline';

                const currenttitle = friend.presence.game as PresenceGame;

                debugFriends('%s is now online%s%s, title %s %s - played for %s since %s', friend.name,
                    friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                    consolewasonline ? ' (console was already online)' : '',
                    currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                    hrduration(currenttitle.totalPlayTime),
                    currenttitle.firstPlayedAt ? new Date(currenttitle.firstPlayedAt * 1000).toString() : 'now');

                if (consolewasonline) {
                    // Friend's console was already online
                }
            } else if (wasonline && !online) {
                // Friend has gone offline
                type = PresenceEvent.STATE_CHANGE;
                callback = 'onFriendOffline';

                const lasttitle = lastpresence.game as PresenceGame;

                debugFriends('%s is now offline%s, was playing title %s %s, logout time %s', friend.name,
                    friend.presence.state !== PresenceState.OFFLINE ? ' (console still online)' : '',
                    lasttitle.name, JSON.stringify(lasttitle.sysDescription),
                    friend.presence.logoutAt ? new Date(friend.presence.logoutAt * 1000).toString() : null);

                if (friend.presence.state !== PresenceState.OFFLINE) {
                    // Friend's console is still online
                }
            } else if (wasonline && online) {
                // Friend is still online
                const lasttitle = lastpresence.game as PresenceGame;
                const currenttitle = friend.presence.game as PresenceGame;

                if (getTitleIdFromEcUrl(lasttitle.shopUri) !== getTitleIdFromEcUrl(currenttitle.shopUri)) {
                    // Friend is playing a different title
                    type = PresenceEvent.TITLE_CHANGE;
                    callback = 'onFriendPlayingChangeTitle';

                    debugFriends('%s title is now %s %s%s, was playing %s %s%s - played for %s since %s',
                        friend.name,
                        currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                        friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                        lasttitle.name, JSON.stringify(lasttitle.sysDescription),
                        lastpresence.state === PresenceState.ONLINE ? '' : ' (' + lastpresence.state + ')',
                        hrduration(currenttitle.totalPlayTime),
                        currenttitle.firstPlayedAt ? new Date(currenttitle.firstPlayedAt * 1000).toString() : 'now');
                } else if (lasttitle.sysDescription !== currenttitle.sysDescription) {
                    // Title state changed (presence state may have also changed between online/playing)
                    type = PresenceEvent.TITLE_STATE_CHANGE;
                    callback = 'onFriendTitleStateChange';

                    debugFriends('%s title %s state changed, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));
                } else if (lastpresence.state !== friend.presence.state) {
                    // Presence state changed (between online/playing)
                    type = PresenceEvent.TITLE_STATE_CHANGE;
                    callback = 'onFriendTitleStateChange';

                    debugFriends('%s title %s state changed, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));
                }
            } else if (!consolewasonline && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is now online, but the user is not playing
                type = PresenceEvent.STATE_CHANGE;

                debugFriends('%s\'s console is now online', friend.name);
            } else if (consolewasonline && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is still online, the user is still not playing
            } else if (consolewasonline && friend.presence.state === PresenceState.OFFLINE) {
                // Friend's console is now offline
                type = PresenceEvent.STATE_CHANGE;

                debugFriends('%s\'s console is now offline', friend.name);
            }

            if (lastpresence?.updatedAt !== friend.presence.updatedAt && !initialRun) {
                this.onPresenceUpdated?.(friend, prev, type, naid, initialRun);
            }
            if (callback) {
                this[callback]?.(friend, prev, naid, initialRun);
            }
        }

        for (const friend of this.onlinefriends.get(naid) ?? []) {
            const updated = newonlinefriends.find(f => f.nsaId === friend.nsaId);

            if (!updated) {
                // The authenticated user is no longer friends with this user, or received an empty presence
                // object (no longer has permission to view the user's status?)

                if (this.accounts.get(friend.nsaId) !== naid) continue;
                this.accounts.delete(friend.nsaId);

                for (const [naid, onlinefriends] of this.onlinefriends) {
                    if (onlinefriends.find(f => f.nsaId === friend.nsaId &&
                        (f.presence.state !== PresenceState.OFFLINE || f.presence.updatedAt)
                    )) {
                        this.accounts.set(friend.nsaId, naid);
                        break;
                    }
                }
            }
        }

        this.onlinefriends.set(naid, newonlinefriends);
    }

    removeAccount(naid: string) {
        const onlinefriends = this.onlinefriends.get(naid);
        if (!onlinefriends) return;

        this.onlinefriends.delete(naid);

        for (const friend of onlinefriends) {
            if (this.accounts.get(friend.nsaId) !== naid) continue;
            this.accounts.delete(friend.nsaId);

            for (const [naid, onlinefriends] of this.onlinefriends) {
                if (onlinefriends.find(f => f.nsaId === friend.nsaId &&
                    (f.presence.state !== PresenceState.OFFLINE || f.presence.updatedAt)
                )) {
                    this.accounts.set(friend.nsaId, naid);
                    break;
                }
            }
        }
    }
}

export enum PresenceEvent {
    STATE_CHANGE,
    TITLE_CHANGE,
    TITLE_STATE_CHANGE,
}

export class EmbeddedSplatNet2Monitor extends SplatNet2RecordsMonitor {
    static title_ids = [
        '0100f8f0000a2000', // Europe
        '01003bc0000a0000', // The Americas
        '01003c700009c000', // Japan
    ];

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
    }

    get enabled() {
        return this._running !== 0;
    }

    private _running = 0;

    private async _run() {
        this._running++;
        const i = this._running;

        try {
            await this.loop(true);

            while (i === this._running) {
                await this.loop();
            }

            if (this._running === 0) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

            debugSplatnet2('SplatNet 2 monitoring finished');
        } finally {
            this._running = 0;
        }
    }
}
