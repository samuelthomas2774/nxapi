import process from 'node:process';
import { fetch } from 'undici';
import { getPresenceFromUrl } from '../../api/znc-proxy.js';
import { ActiveEvent, CurrentUser, Friend, PresenceGame, PresenceOffline, PresenceOnline, PresenceOnline_4, PresencePlatform, PresenceState } from '../../api/coral-types.js';
import type { Arguments as ParentArguments } from './index.js';
import { getDiscordPresence, getInactiveDiscordPresence } from '../../discord/util.js';
import { DiscordPresenceContext, DiscordPresencePlayTime } from '../../discord/types.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/coral.js';
import { timeoutSignal } from '../../util/misc.js';
import { getUserAgent } from '../../util/useragent.js';

const debug = createDebug('cli:util:discord-activity');

type Presence = PresenceOnline | PresenceOnline_4 | PresenceOffline;

export const command = 'discord-activity';
export const desc = 'Get Nintendo Switch presence as a Discord activity';

// Discord documentation:
// https://discord.com/developers/docs/rich-presence/how-to
//
// This image shows how each field appears in Discord:
// https://github.com/discord/discord-api-docs/blob/main/images/rp-legend.png

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    }).option('user', {
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
        describe: 'Friend\'s Nintendo Switch account ID',
        type: 'string',
    }).option('friend-code', {
        describe: 'Friend code',
        type: 'string',
    }).option('presence-url', {
        describe: 'URL to get user presence from, for use with `nxapi nso http-server`',
        type: 'string',
    }).option('presence-json', {
        describe: 'Presence JSON',
        type: 'string',
    }).option('show-discord-application', {
        describe: 'Show the Discord application that will be used - this includes the name that will appear in Discord',
        type: 'boolean',
        default: true,
    }).option('json', {
        describe: 'Output raw JSON',
        type: 'boolean',
    }).option('json-pretty-print', {
        describe: 'Output pretty-printed JSON',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presenceJson) {
        if (argv.showEvent) throw new Error('--presence-json not compatible with --show-event');
        if (argv.friendNsaid) throw new Error('--presence-json not compatible with --friend-nsaid');
        if (argv.presenceUrl) throw new Error('--presence-json not compatible with --presence-url');
    }
    if (argv.presenceUrl) {
        if (argv.showEvent) throw new Error('--presence-url not compatible with --show-event');
        if (argv.friendNsaid) throw new Error('--presence-url not compatible with --friend-nsaid');
    }

    const [presence, user, response, friendcode, activeevent] =
        argv.presenceJson ? await getPresenceFromJson(argv.presenceJson) :
        argv.presenceUrl ? await getPresenceFromUrl(argv.presenceUrl) as
            readonly [Presence, CurrentUser | Friend | undefined, unknown] :
        await getPresenceFromCoral(argv);

    const discordpresence = getActivityFromPresence(argv, presence, user, friendcode, activeevent, response);
    const application = argv.showDiscordApplication ?
        discordpresence ? await getDiscordApplicationRpc(discordpresence.id) : null : undefined;

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify({
            ...discordpresence,
            application,
        }, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify({
            ...discordpresence,
            application,
        }));
        return;
    }

    console.log('Activity', discordpresence);
    if (application) console.log('Application', application);
}

async function getPresenceFromJson(json: string) {
    const data = JSON.parse(json);

    const state: PresenceState =
        data.state === 'PLAYING' ? PresenceState.PLAYING :
        data.state === 'ONLINE' ? PresenceState.ONLINE :
        data.state === 'INACTIVE' ? PresenceState.INACTIVE :
        PresenceState.OFFLINE;

    const game: PresenceGame | null = data.game && 'name' in data.game ? {
        name: typeof data.game.name === 'string' ? data.game.name : 'undefined',
        imageUri: typeof data.game.imageUri === 'string' ? data.game.imageUrl : null,
        shopUri: typeof data.game.shopUri === 'string' ? data.game.shopUri : null,
        totalPlayTime: typeof data.game.totalPlayTime === 'number' ? data.game.totalPlayTime : 0,
        firstPlayedAt: typeof data.game.firstPlayedAt === 'number' ? data.game.firstPlayedAt : 0,
        sysDescription: typeof data.game.sysDescription === 'string' ? data.game.sysDescription : '',
    } : null;

    // @ts-expect-error
    const presence: Presence = {
        state,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
        logoutAt: typeof data.logoutAt === 'number' ? data.logoutAt : 0,
        game: game ?? {},
    };

    if (state === PresenceState.ONLINE || state === PresenceState.PLAYING) {
        // @ts-expect-error
        presence.platform = typeof data.platform === 'number' ? data.platform : PresencePlatform.NX;
    }

    return [presence] as const;
}

async function getPresenceFromCoral(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [friends, chats, webservices, activeevent, media, announcements, user] = await Promise.all([
        nso.getFriendList(),
        nso.getChats(),
        nso.getWebServices(),
        nso.getActiveEvent(),
        nso.getMedia(),
        nso.getAnnouncements(),
        nso.getCurrentUser(),
    ]);

    if (argv.friendNsaid) {
        const friend = friends.friends.find(f => f.nsaId === argv.friendNsaid);

        if (!friend) {
            throw new Error('User "' + argv.friendNsaid + '" is not friends with this user');
        }

        return [friend.presence, friend] as const;
    } else {
        return [user.presence, user, user, user.links.friendCode,
            'id' in activeevent ? activeevent : undefined] as const;
    }
}

function getActivityFromPresence(
    argv: ArgumentsCamelCase<Arguments>,
    presence: Presence | null,
    user?: CurrentUser | Friend,
    friendcode?: CurrentUser['links']['friendCode'],
    activeevent?: ActiveEvent,
    proxy_response?: unknown,
) {
    const online = presence?.state === PresenceState.ONLINE || presence?.state === PresenceState.PLAYING;

    const show_presence =
        (online && 'name' in presence.game) ||
        (argv.showInactivePresence && presence?.state === PresenceState.INACTIVE);

    if (!presence || !show_presence) return null;

    let match;
    const force_friend_code =
        (match = (argv.friendCode as string)?.match(/^(SW-)?(\d{4})-?(\d{4})-?(\d{4})$/)) ?
            {id: match[2] + '-' + match[3] + '-' + match[4], regenerable: false, regenerableAt: 0} : undefined;
    const show_friend_code = !!force_friend_code || argv.friendCode === '' || argv.friendCode === '-';

    const show_play_time = argv.showPlayTime.toLowerCase() === 'hidden' ? DiscordPresencePlayTime.HIDDEN :
        argv.showPlayTime.toLowerCase() === 'nintendo' ? DiscordPresencePlayTime.NINTENDO :
        argv.showPlayTime.toLowerCase() === 'approximate' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME :
        argv.showPlayTime.toLowerCase() === 'approximate-since' ? DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE :
        argv.showPlayTime.toLowerCase() === 'hour' ? DiscordPresencePlayTime.HOUR_PLAY_TIME :
        argv.showPlayTime.toLowerCase() === 'hour-since' ? DiscordPresencePlayTime.HOUR_PLAY_TIME_SINCE :
        argv.showPlayTime.toLowerCase() === 'detailed' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME :
        argv.showPlayTime.toLowerCase() === 'detailed-since' ? DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE :
        DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

    const presencecontext: DiscordPresenceContext = {
        friendcode: show_friend_code ? force_friend_code ?? friendcode : undefined,
        activeevent,
        show_play_time,
        // znc_discord_presence: this,
        proxy_response,
        nsaid: argv.friendNsaid ?? user?.nsaId,
        user,
        platform: 'platform' in presence ? presence.platform : undefined,
    };

    const discordpresence = 'name' in presence.game ?
        getDiscordPresence(presence.state, presence.game, presencecontext) :
        getInactiveDiscordPresence(presence.state, presence.logoutAt, presencecontext);

    if (discordpresence.showTimestamp) {
        discordpresence.activity.startTimestamp = Date.now();
    }

    return discordpresence;
}

export interface DiscordApplicationRpc {
    id: string;
    name: string;
    icon: string | null;
    description: string;
    summary: string;
    type: null;
    cover_image?: string;
    hook: boolean;
    verify_key: string;
    flags: number;
}

export async function getDiscordApplicationRpc(id: string) {
    if (!id.match(/^\d{18,}$/)) {
        throw new Error('Invalid Discord application ID');
    }

    const url = 'https://discord.com/api/v9/applications/' + id + '/rpc';

    const [signal, cancel] = timeoutSignal();
    const response = await fetch(url, {
        headers: {
            'User-Agent': getUserAgent(),
        },
        signal,
    }).finally(cancel);

    debug('fetch %s %s, response %s', 'GET', url, response.status);

    if (response.status !== 200) {
        console.error('Non-200 status code', await response.text());
        throw new Error('Unknown error');
    }

    const application = await response.json() as DiscordApplicationRpc;

    return application;
}
