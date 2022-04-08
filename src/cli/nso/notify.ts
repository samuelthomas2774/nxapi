import createDebug from 'debug';
import persist from 'node-persist';
import notifier from 'node-notifier';
import * as path from 'path';
import { ActiveEvent, Announcements, CurrentUser, Friend, Game, Presence, PresenceState, WebServices, ZncErrorResponse } from '../../api/znc-types.js';
import ZncApi from '../../api/znc.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, getTitleIdFromEcUrl, getToken, hrduration, initStorage, Loop, LoopResult, SavedToken, YargsArguments } from '../../util.js';
import ZncProxyApi from '../../api/znc-proxy.js';
import { SplatNet2RecordsMonitor } from '../splatnet2/monitor.js';
import { getIksmToken } from '../splatnet2/util.js';
import { ErrorResponse } from '../../api/util.js';

const debug = createDebug('cli:nso:notify');
const debugFriends = createDebug('cli:nso:notify:friends');
const debugSplatnet2 = createDebug('cli:nso:notify:splatnet2-monitor');

export const command = 'notify';
export const desc = 'Show notifications when friends come online without starting Discord Rich Presence';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('user-notifications', {
        describe: 'Show notification for your own user',
        type: 'boolean',
        default: false,
    }).option('friend-notifications', {
        describe: 'Show notification for friends',
        type: 'boolean',
        default: true,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        default: 30,
    }).option('splatnet2-monitor', {
        describe: 'Download new SplatNet 2 data when you are playing Splatoon 2 online',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-directory', {
        alias: ['sn2-path'],
        describe: 'Directory to write SplatNet 2 record data to',
        type: 'string',
    }).option('splatnet2-monitor-profile-image', {
        alias: ['sn2-profile-image'],
        describe: 'Include profile image',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-favourite-stage', {
        alias: ['sn2-favourite-stage'],
        describe: 'Favourite stage to include on profile image',
        type: 'string',
    }).option('splatnet2-monitor-favourite-colour', {
        alias: ['sn2-favourite-colour'],
        describe: 'Favourite colour to include on profile image',
        type: 'string',
    }).option('splatnet2-monitor-battles', {
        alias: ['sn2-battles'],
        describe: 'Include regular/ranked/private/festival battle results',
        type: 'boolean',
        default: true,
    }).option('splatnet2-monitor-battle-summary-image', {
        alias: ['sn2-battle-summary-image'],
        describe: 'Include regular/ranked/private/festival battle summary image',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-battle-images', {
        alias: ['sn2-battle-images'],
        describe: 'Include regular/ranked/private/festival battle result images',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-coop', {
        alias: ['sn2-coop'],
        describe: 'Include coop (Salmon Run) results',
        type: 'boolean',
        default: true,
    }).option('splatnet2-monitor-update-interval', {
        alias: ['sn2-update-interval'],
        describe: 'Update interval in seconds',
        type: 'number',
        // 3 minutes - the monitor is only active while the authenticated user is playing Splatoon 2 online
        default: 3 * 60,
    }).option('splatnet2-auto-update-session', {
        alias: ['sn2-auto-update-session'],
        describe: 'Automatically obtain and refresh the iksm_session cookie',
        type: 'boolean',
        default: true,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!argv.userNotifications && !argv.friendNotifications && !argv.splatnet2Monitor) {
        throw new Error('Must enable either user notifications, friend notifications, or SplatNet 2 monitoring');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const i = new ZncNotifications(argv, storage, token, nso, data);

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    if (argv.splatnet2Monitor) {
        console.warn('SplatNet 2 monitoring enabled for %s (NA %s, NSO %s) - SplatNet 2 records will be ' +
            'downloaded when this user is playing Splatoon 2 online.',
            data.user.screenName, data.user.nickname, data.nsoAccount.user.name);
        i.splatnet2_monitors.set(data.nsoAccount.user.nsaId, handleEnableSplatNet2Monitoring(argv, storage, token));
    }

    await i.init();

    while (true) {
        await i.loop();
    }
}

export class ZncNotifications extends Loop {
    splatnet2_monitors = new Map<string, EmbeddedSplatNet2Monitor | (() => Promise<EmbeddedSplatNet2Monitor>)>();

    user_notifications = true;
    friend_notifications = true;
    update_interval = 30;

    constructor(
        argv: Pick<ArgumentsCamelCase<Arguments>, 'userNotifications' | 'friendNotifications' | 'updateInterval'>,
        public storage: persist.LocalStorage,
        public token: string,
        public nso: ZncApi,
        public data: Omit<SavedToken, 'expires_at'>,
    ) {
        super();

        this.user_notifications = argv.userNotifications;
        this.friend_notifications = argv.friendNotifications;
        this.update_interval = argv.updateInterval;
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
                        isServiceUser: true,
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

        await this.updatePresenceForNotifications(user, friends, true);
        await this.updatePresenceForSplatNet2Monitors([user!]);

        await new Promise(rs => setTimeout(rs, this.update_interval * 1000));
    }

    onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        notifier.notify({
            title: friend.name,
            message: 'Offline',
            icon: friend.imageUri,
        });
    }

    onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onlinefriends: (CurrentUser | Friend)[] = [];

    async updateFriendsStatusForNotifications(friends: (CurrentUser | Friend)[], initialRun?: boolean) {
        const newonlinefriends: (CurrentUser | Friend)[] = [];

        for (const friend of friends) {
            const prev = this.onlinefriends.find(f => f.nsaId === friend.nsaId);
            const lastpresence = prev?.presence;
            const online = friend.presence.state === PresenceState.ONLINE ||
                friend.presence.state === PresenceState.PLAYING;
            const wasonline = lastpresence?.state === PresenceState.ONLINE ||
                lastpresence?.state === PresenceState.PLAYING;

            if (!wasonline && online) {
                // Friend has come online
                const currenttitle = friend.presence.game as Game;

                debugFriends('%s is now online%s%s, title %s %s - played for %s since %s', friend.name,
                    friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                    lastpresence ? ' (console was already online)' : '',
                    currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                    hrduration(currenttitle.totalPlayTime),
                    new Date((currenttitle.firstPlayedAt ?? 0) * 1000).toString());

                this.onFriendOnline(friend, prev, initialRun);

                newonlinefriends.push(friend);

                if (lastpresence) {
                    // Friend's console was already online
                }
            } else if (wasonline && !online) {
                // Friend has gone offline
                const lasttitle = lastpresence.game as Game;

                debugFriends('%s is now offline%s, was playing title %s %s', friend.name,
                    friend.presence.state !== PresenceState.OFFLINE ? ' (console still online)' : '',
                    lasttitle.name, JSON.stringify(lasttitle.sysDescription));

                this.onFriendOffline(friend, prev, initialRun);

                if (friend.presence.state !== PresenceState.OFFLINE) {
                    // Friend's console is still online
                    newonlinefriends.push(friend);
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
                        new Date((currenttitle.firstPlayedAt ?? 0) * 1000).toString());

                    this.onFriendPlayingChangeTitle(friend, prev, initialRun);
                } else if (
                    lastpresence.state !== friend.presence.state ||
                    lasttitle.sysDescription !== currenttitle.sysDescription
                ) {
                    // Title state changed

                    debugFriends('%s title %s state changed, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));

                    this.onFriendTitleStateChange(friend, prev, initialRun);
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

                newonlinefriends.push(friend);
            } else if (!lastpresence && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is now online, but the user is not playing

                debugFriends('%s\'s console is now online', friend.name);

                newonlinefriends.push(friend);
            } else if (lastpresence && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is still online, the user is still not playing

                newonlinefriends.push(friend);
            } else if (lastpresence && friend.presence.state === PresenceState.OFFLINE) {
                // Friend's console is now offline

                debugFriends('%s\'s console is now offline', friend.name);
            }
        }

        this.onlinefriends = newonlinefriends;
    }

    async updatePresenceForNotifications(
        user: CurrentUser | undefined, friends: Friend[] | undefined, initialRun?: boolean
    ) {
        await this.updateFriendsStatusForNotifications(([] as (CurrentUser | Friend)[])
            .concat(this.user_notifications && user ? [user] : [])
            .concat(this.friend_notifications && friends ? friends : []), initialRun);
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
        await this.updatePresenceForSplatNet2Monitors([user!]);
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
            await this.init();

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

export function handleEnableSplatNet2Monitoring(
    argv: ArgumentsCamelCase<Arguments>, storage: persist.LocalStorage, token: string
) {
    return async () => {
        const directory = argv.splatnet2MonitorDirectory ?? path.join(argv.dataPath, 'splatnet2');

        const {splatnet, data} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.splatnet2AutoUpdateSession);

        const records = await splatnet.getRecords();
        const stages = await splatnet.getStages();

        const i = new EmbeddedSplatNet2Monitor(storage, token, splatnet, stages, directory, argv.zncProxyUrl);

        i.update_interval = argv.splatnet2MonitorUpdateInterval;

        i.profile_image = argv.splatnet2MonitorProfileImage;
        i.favourite_stage = argv.splatnet2MonitorFavouriteStage;
        i.favourite_colour = argv.splatnet2MonitorFavouriteColour;

        i.results = argv.splatnet2MonitorBattles;
        i.results_summary_image = argv.splatnet2MonitorBattleSummaryImage;
        i.result_images = argv.splatnet2MonitorBattleImages;
        i.coop_results = argv.splatnet2MonitorCoop;

        i.cached_records = records;

        console.log('Player %s (Splatoon 2 ID %s, NSA ID %s) level %d',
            records.records.player.nickname,
            records.records.unique_id,
            records.records.player.principal_id,
            records.records.player.player_rank,
            records.records.player.player_type);

        return i;
    };
}
