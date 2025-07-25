import * as path from 'node:path';
import persist from 'node-persist';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/coral.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';
import { EmbeddedSplatNet2Monitor, NotificationManager, ZncNotifications } from '../../common/notify.js';
import { CurrentUser, Friend, PresenceGame } from '../../api/coral-types.js';
import Users from '../../common/users.js';

const debug = createDebug('cli:nso:notify');

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

    const users = Users.coral(storage, argv.zncProxyUrl);
    const user = await users.get(token);

    const data = user.data;

    const i = new ZncNotifications(user);

    i.notifications = await TerminalNotificationManager.create();
    i.user_notifications = argv.userNotifications;
    i.friend_notifications = argv.friendNotifications;
    i.update_interval = argv.updateInterval;

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    if (argv.splatnet2Monitor) {
        console.warn('SplatNet 2 monitoring enabled for %s (NA %s, NSO %s) - SplatNet 2 records will be ' +
            'downloaded when this user is playing Splatoon 2 online.',
            data.user.screenName, data.user.nickname, data.nsoAccount.user.name);
        i.splatnet2_monitors.set(data.nsoAccount.user.nsaId, handleEnableSplatNet2Monitoring(argv, storage, token));
    }

    await i.loop(true);

    while (true) {
        await i.loop();
    }
}

export class TerminalNotificationManager extends NotificationManager {
    constructor(private readonly notifier: typeof import('node-notifier')) {
        super();
    }

    onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as PresenceGame;

        this.notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        this.notifier.notify({
            title: friend.name,
            message: 'Offline',
            icon: friend.imageUri,
        });
    }

    onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as PresenceGame;

        this.notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as PresenceGame;

        this.notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    static async create() {
        const notifier = (await import('node-notifier')).default;

        return new TerminalNotificationManager(notifier);
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
