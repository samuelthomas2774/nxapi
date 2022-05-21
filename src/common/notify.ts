import createDebug from 'debug';
import persist from 'node-persist';
import { getTitleIdFromEcUrl, hrduration, Loop, LoopResult } from '../util.js';
import ZncApi from '../api/znc.js';
import { ActiveEvent, Announcements, CurrentUser, Friend, Game, Presence, PresenceState, WebServices, ZncErrorResponse } from '../api/znc-types.js';
import ZncProxyApi from '../api/znc-proxy.js';
import { ErrorResponse } from '../api/util.js';
import { SavedToken } from './auth/nso.js';
import { SplatNet2RecordsMonitor } from './splatnet2/monitor.js';

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
        public storage: persist.LocalStorage,
        public token: string,
        public nso: ZncApi,
        public data: Omit<SavedToken, 'expires_at'>,
    ) {
        super();
    }

    async fetch(req: (
        'announcements' | 'friends' | {friend: string; presence?: boolean} | 'webservices' | 'event' | 'user' | null
    )[]) {
        const result: Partial<{
            announcements: Announcements;
            friends: Friend[];
            webservices: WebServices;
            activeevent: ActiveEvent;
            user: CurrentUser;
        }> = {};

        const friends = req.filter(r => typeof r === 'object' && r && 'friend' in r) as
            {friend: string; presence?: boolean}[];

        if (!(this.nso instanceof ZncProxyApi)) {
            if (req.includes('announcements')) req.push('friends', 'webservices', 'event');
            if (req.includes('webservices')) req.push('friends', 'event');
            if (req.includes('event')) req.push('friends', 'webservices');
        }

        if (req.includes('announcements')) {
            result.announcements = (await this.nso.getAnnouncements()).result;
        }
        if (req.includes('friends') || (friends && !(this.nso instanceof ZncProxyApi))) {
            result.friends = (await this.nso.getFriendList()).result.friends;
        } else if (friends && this.nso instanceof ZncProxyApi) {
            result.friends = await Promise.all(friends.map(async r => {
                const nso = this.nso as unknown as ZncProxyApi;

                if (r.presence) {
                    const friend: Friend = {
                        id: 0,
                        nsaId: r.friend,
                        imageUri: '',
                        name: '',
                        isFriend: true,
                        isFavoriteFriend: false,
                        isServiceUser: false,
                        friendCreatedAt: 0,
                        presence: await nso.fetch<Presence>('/friend/' + r.friend + '/presence'),
                    };

                    return friend;
                }

                return (await nso.fetch<{friend: Friend}>('/friend/' + r.friend)).friend;
            }))
        }
        if (req.includes('webservices')) {
            result.webservices = (await this.nso.getWebServices()).result;
        }
        if (req.includes('event')) {
            const activeevent = (await this.nso.getActiveEvent()).result;
            result.activeevent = 'id' in activeevent ? activeevent : undefined;
        }
        if (req.includes('user')) {
            result.user = (await this.nso.getCurrentUser()).result;
        }

        return result;
    }

    async init() {
        const {friends, user} = await this.fetch([
            'announcements',
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        await this.updatePresenceForNotifications(user, friends, this.data.user.id, true);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);

        return LoopResult.OK;
    }

    async updateFriendsStatusForNotifications(
        friends: (CurrentUser | Friend)[],
        naid = this.data.user.id,
        initialRun?: boolean
    ) {
        this.notifications.updateFriendsStatusForNotifications(friends, naid, initialRun);
    }

    async updatePresenceForNotifications(
        user: CurrentUser | undefined, friends: Friend[] | undefined,
        naid = this.data.user.id, initialRun?: boolean
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
            const currenttitle = presence.game as Game;
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
        const {friends, user} = await this.fetch([
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        await this.updatePresenceForNotifications(user, friends);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    async handleError(err: ErrorResponse<ZncErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        if (err && 'response' in err && err.data?.status === 9404) {
            // Token expired
            debug('Renewing token');

            const data = await this.nso.renewToken(this.token, this.data.user);

            const existingToken: SavedToken = {
                user: this.data.user,
                ...data,
                expires_at: Date.now() + (data.credential.expiresIn * 1000),
            };

            await this.storage.setItem('NsoToken.' + this.token, existingToken);

            return LoopResult.OK_SKIP_INTERVAL;
        } else if ('code' in err && (err as any).type === 'system' && err.code === 'ETIMEDOUT') {
            debug('Request timed out, waiting %ds before retrying', this.update_interval, err);

            return LoopResult.OK;
        } else if ('code' in err && (err as any).type === 'system' && err.code === 'ENOTFOUND') {
            debug('Request error, waiting %ds before retrying', this.update_interval, err);

            return LoopResult.OK;
        } else {
            throw err;
        }
    }
}

export class NotificationManager {
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

            if (!wasonline && online) {
                // Friend has come online
                const currenttitle = friend.presence.game as Game;

                debugFriends('%s is now online%s%s, title %s %s - played for %s since %s', friend.name,
                    friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                    consolewasonline ? ' (console was already online)' : '',
                    currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                    hrduration(currenttitle.totalPlayTime),
                    currenttitle.firstPlayedAt ? new Date(currenttitle.firstPlayedAt * 1000).toString() : 'now');

                this.onFriendOnline?.(friend, prev, naid, initialRun);

                if (consolewasonline) {
                    // Friend's console was already online
                }
            } else if (wasonline && !online) {
                // Friend has gone offline
                const lasttitle = lastpresence.game as Game;

                debugFriends('%s is now offline%s, was playing title %s %s', friend.name,
                    friend.presence.state !== PresenceState.OFFLINE ? ' (console still online)' : '',
                    lasttitle.name, JSON.stringify(lasttitle.sysDescription));

                this.onFriendOffline?.(friend, prev, naid, initialRun);

                if (friend.presence.state !== PresenceState.OFFLINE) {
                    // Friend's console is still online
                }
            } else if (wasonline && online) {
                // Friend is still online
                const lasttitle = lastpresence.game as Game;
                const currenttitle = friend.presence.game as Game;

                if (getTitleIdFromEcUrl(lasttitle.shopUri) !== getTitleIdFromEcUrl(currenttitle.shopUri)) {
                    // Friend is playing a different title

                    debugFriends('%s title is now %s %s%s, was playing %s %s%s - played for %s since %s',
                        friend.name,
                        currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                        friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                        lasttitle.name, JSON.stringify(lasttitle.sysDescription),
                        lastpresence.state === PresenceState.ONLINE ? '' : ' (' + lastpresence.state + ')',
                        hrduration(currenttitle.totalPlayTime),
                        currenttitle.firstPlayedAt ? new Date(currenttitle.firstPlayedAt * 1000).toString() : 'now');

                    this.onFriendPlayingChangeTitle?.(friend, prev, naid, initialRun);
                } else if (
                    lastpresence.state !== friend.presence.state ||
                    lasttitle.sysDescription !== currenttitle.sysDescription
                ) {
                    // Title state changed

                    debugFriends('%s title %s state changed, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));

                    this.onFriendTitleStateChange?.(friend, prev, naid, initialRun);
                } else if (
                    lastpresence.state !== friend.presence.state ||
                    lasttitle.sysDescription !== currenttitle.sysDescription
                ) {
                    // Presence state changed (between online/playing)

                    debugFriends('%s title %s state changed%s, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));
                }
            } else if (!consolewasonline && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is now online, but the user is not playing

                debugFriends('%s\'s console is now online', friend.name);
            } else if (consolewasonline && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is still online, the user is still not playing
            } else if (consolewasonline && friend.presence.state === PresenceState.OFFLINE) {
                // Friend's console is now offline

                debugFriends('%s\'s console is now offline', friend.name);
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
