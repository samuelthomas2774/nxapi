import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/coral.js';
import { DiscordPresencePlayTime } from '../../discord/types.js';
import { handleEnableSplatNet2Monitoring, TerminalNotificationManager } from './notify.js';
import { ZncDiscordPresence, ZncProxyDiscordPresence } from '../../common/presence.js';
import SplatNet3Monitor, { getConfigFromArgv as getSplatNet3MonitorConfigFromArgv } from '../../discord/monitor/splatoon3.js';

const debug = createDebug('cli:nso:presence');
const debugProxy = createDebug('cli:nso:presence:proxy');
const debugDiscord = createDebug('cli:nso:presence:discordrpc');

export const command = 'presence';
export const desc = 'Start Discord Rich Presence';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('show-inactive-presence', {
        describe: 'Show Discord presence if your console is online but you are not playing (only enable if you are the only user on all consoles your account exists on)',
        type: 'boolean',
        default: false,
    }).option('show-event', {
        describe: 'Show event (Online Lounge/voice chat) details - this shows the number of players in game (experimental)',
        type: 'boolean',
        default: false,
    }).option('show-play-time', {
        describe: 'Play time format ("hidden", "nintendo", "approximate", "approximate-since", "detailed", "detailed-since")',
        type: 'string',
        default: 'detailed-since',
    }).option('friend-nsaid', {
        alias: ['friend-naid'],
        describe: 'Friend\'s Nintendo Switch account ID',
        type: 'string',
    }).option('friend-code', {
        describe: 'Friend code',
        type: 'string',
    }).option('user-notifications', {
        describe: 'Show notification for your own user',
        type: 'boolean',
        default: false,
    }).option('friend-notifications', {
        describe: 'Show notification for friends',
        type: 'boolean',
        default: false,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        default: 30,
    }).option('presence-url', {
        describe: 'URL to get user presence from, for use with `nxapi nso http-server`',
        type: 'string',
    }).option('discord-preconnect', {
        describe: 'Stay connected to Discord while not playing',
        type: 'boolean',
        default: false,
    }).option('discord-user', {
        describe: 'Discord user ID (choose which Discord client to use when multiple are available)',
        type: 'string',
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
        describe: 'Automatically obtain and refresh the SplatNet 2 iksm_session cookie',
        type: 'boolean',
        default: true,
    }).option('splatnet3-monitor', {
        describe: 'Show additional presence data from SplatNet 3 while playing Splatoon 3',
        type: 'boolean',
        default: false,
    }).option('splatnet3-auto-update-session', {
        alias: ['sn3-auto-update-session'],
        describe: 'Automatically obtain and refresh the SplatNet 3 access token',
        type: 'boolean',
        default: true,
    });
}

export type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presenceUrl) {
        if (argv.showEvent) throw new Error('--presence-url not compatible with --show-event');
        if (argv.friendNsaid) throw new Error('--presence-url not compatible with --friend-nsaid');
        if (argv.userNotifications) throw new Error('--presence-url not compatible with --user-notifications');
        if (argv.friendNotifications) throw new Error('--presence-url not compatible with --friend-notifications');

        const i = new ZncProxyDiscordPresence(argv.presenceUrl);

        i.update_interval = argv.updateInterval;

        let match;
        i.force_friend_code =
            (match = (argv.friendCode as string)?.match(/^(SW-)?(\d{4})-?(\d{4})-?(\d{4})$/)) ?
                {id: match[2] + '-' + match[3] + '-' + match[4], regenerable: false, regenerableAt: 0} : undefined;
        i.show_friend_code = !!i.force_friend_code || argv.friendCode === '' || argv.friendCode === '-';
        i.show_console_online = argv.showInactivePresence;

        i.show_play_time = argv.showPlayTime.toLowerCase() === 'hidden' ? DiscordPresencePlayTime.HIDDEN :
            argv.showPlayTime.toLowerCase() === 'nintendo' ? DiscordPresencePlayTime.NINTENDO :
            argv.showPlayTime.toLowerCase() === 'approximate' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME :
            argv.showPlayTime.toLowerCase() === 'approximate-since' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE :
            argv.showPlayTime.toLowerCase() === 'detailed' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME :
            argv.showPlayTime.toLowerCase() === 'detailed-since' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE :
            DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

        i.discord_preconnect = argv.discordPreconnect;
        if (argv.discordUser) i.discord_client_filter = (client, id) => client.user?.id === argv.discordUser;

        if (argv.splatnet2Monitor) {
            const storage = await initStorage(argv.dataPath);

            const usernsid = argv.user ?? await storage.getItem('SelectedUser');
            const token: string = argv.token ||
                await storage.getItem('NintendoAccountToken.' + usernsid);
            const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

            console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
                data.user.screenName, data.user.nickname, data.nsoAccount.user.name);
            console.warn('SplatNet 2 monitoring is enabled for %s (NA %s, NSO %s), but using znc proxy for ' +
                'presence. The presence URL must return the presence of the authenticated user for SplatNet 2 ' +
                'monitoring to work.',
                data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

            i.splatnet2_monitors.set(argv.presenceUrl, handleEnableSplatNet2Monitoring(argv, storage, token));
        } else {
            if (argv.user) throw new Error('--presence-url not compatible with --user');
            if (argv.token) throw new Error('--presence-url not compatible with --token');

            console.warn('Not authenticated; using znc proxy');
        }

        await i.loop(true);

        while (true) {
            await i.loop();
        }

        return;
    }

    if (argv.showEvent && argv.friendNsaid) throw new Error('--show-event not compatible with --friend-nsaid');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const i = new ZncDiscordPresence(storage, token, nso, data);

    const notifier = (await import('node-notifier')).default;
    i.notifications = new TerminalNotificationManager(notifier);
    i.user_notifications = argv.userNotifications;
    i.friend_notifications = argv.friendNotifications;
    i.update_interval = argv.updateInterval;

    let match;
    i.force_friend_code =
        (match = (argv.friendCode as string)?.match(/^(SW-)?(\d{4})-?(\d{4})-?(\d{4})$/)) ?
            {id: match[2] + '-' + match[3] + '-' + match[4], regenerable: false, regenerableAt: 0} : undefined;
    i.show_friend_code = !!i.force_friend_code || argv.friendCode === '' || argv.friendCode === '-';
    i.show_console_online = argv.showInactivePresence;
    i.show_active_event = argv.showEvent;

    i.show_play_time = argv.showPlayTime.toLowerCase() === 'hidden' ? DiscordPresencePlayTime.HIDDEN :
        argv.showPlayTime.toLowerCase() === 'nintendo' ? DiscordPresencePlayTime.NINTENDO :
        argv.showPlayTime.toLowerCase() === 'approximate' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME :
        argv.showPlayTime.toLowerCase() === 'approximate-since' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE :
        argv.showPlayTime.toLowerCase() === 'detailed' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME :
        argv.showPlayTime.toLowerCase() === 'detailed-since' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE :
        DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

    i.presence_user = argv.friendNsaid ?? data?.nsoAccount.user.nsaId;
    i.discord_preconnect = argv.discordPreconnect;
    if (argv.discordUser) i.discord_client_filter = (client, id) => client.user?.id === argv.discordUser;

    i.discord.onWillStartMonitor = monitor => {
        if (monitor === SplatNet3Monitor) return getSplatNet3MonitorConfigFromArgv(argv, storage, token);
        return null;
    };

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    if (argv.splatnet2Monitor) {
        // if (argv.friendNsaid) {
        //     console.warn('SplatNet 2 monitoring is enabled, but --friend-nsaid is set. SplatNet 2 records will only be downloaded when the authenticated user is playing Splatoon 2 online, regardless of the --friend-nsaid user.');
        // }

        // i.splatnet2_monitors.set(data.nsoAccount.user.nsaId, handleEnableSplatNet2Monitoring(argv, storage, token));
        console.warn('SplatNet 2 monitoring is not supported when not using --presence-url.');
    }

    await i.loop(true);

    while (true) {
        await i.loop();
    }
}
