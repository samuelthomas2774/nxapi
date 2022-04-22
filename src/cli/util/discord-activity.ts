import createDebug from 'debug';
import fetch from 'node-fetch';
import { ActiveEvent, CurrentUser, Friend, Game, Presence, PresenceState } from '../../api/znc-types.js';
import type { Arguments as ParentArguments } from '../../cli.js';
import { DiscordPresenceContext, getDiscordPresence, getInactiveDiscordPresence } from '../../discord/util.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../../util.js';

const debug = createDebug('cli:util:discord-activity');

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

    const [presence, user, friendcode, activeevent] =
        argv.presenceJson ? await getPresenceFromJson(argv.presenceJson) :
        argv.presenceUrl ? await getPresenceFromUrl(argv.presenceUrl) :
        await getPresenceFromZnc(argv);

    const discordpresence = getActivityFromPresence(argv, presence, user, friendcode, activeevent);
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

    const game: Game | null = data.game && 'name' in data.game ? {
        name: typeof data.game.name === 'string' ? data.game.name : 'undefined',
        imageUri: typeof data.game.imageUri === 'string' ? data.game.imageUrl : null,
        shopUri: typeof data.game.shopUri === 'string' ? data.game.shopUri : null,
        totalPlayTime: typeof data.game.totalPlayTime === 'number' ? data.game.totalPlayTime : 0,
        firstPlayedAt: typeof data.game.firstPlayedAt === 'number' ? data.game.firstPlayedAt : 0,
        sysDescription: typeof data.game.sysDescription === 'string' ? data.game.sysDescription : '',
    } : null;

    const presence: Presence = {
        state,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
        logoutAt: typeof data.updatedAt === 'number' ? data.logoutAt : 0,
        game: game ?? {},
    };

    return [presence] as const;
}

async function getPresenceFromUrl(presence_url: string) {
    const response = await fetch(presence_url);

    debug('fetch %s %s, response %s', 'GET', presence_url, response.status);

    if (response.status !== 200) {
        console.error('Non-200 status code', await response.text());
        throw new Error('Unknown error');
    }

    const presence = await response.json() as Presence;

    return [presence] as const;
}

async function getPresenceFromZnc(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const announcements = await nso.getAnnouncements();
    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();
    const user = 'expires_at' in data ? (await nso.getCurrentUser()).result : data.nsoAccount.user;

    if (argv.friendNsaid) {
        const friend = friends.result.friends.find(f => f.nsaId === argv.friendNsaid);

        if (!friend) {
            throw new Error('User "' + argv.friendNsaid + '" is not friends with this user');
        }

        return [friend.presence, friend] as const;
    } else {
        return [user.presence, user, user.links.friendCode,
            'id' in activeevent.result ? activeevent.result : undefined] as const;
    }
}

function getActivityFromPresence(
    argv: ArgumentsCamelCase<Arguments>,
    presence: Presence | null,
    user?: CurrentUser | Friend,
    friendcode?: CurrentUser['links']['friendCode'],
    activeevent?: ActiveEvent,
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

    const presencecontext: DiscordPresenceContext = {
        friendcode: show_friend_code ? force_friend_code ?? friendcode : undefined,
        activeevent,
        // znc_discord_presence: this,
        nsaid: argv.friendNsaid ?? user?.nsaId,
        user,
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
    if (!id.match(/^\d{18}$/)) {
        throw new Error('Invalid Discord application ID');
    }

    const url = 'https://discord.com/api/v9/applications/' + id + '/rpc';

    const response = await fetch(url);
    debug('fetch %s %s, response %s', 'GET', url, response.status);

    if (response.status !== 200) {
        console.error('Non-200 status code', await response.text());
        throw new Error('Unknown error');
    }

    const application = await response.json() as DiscordApplicationRpc;

    return application;
}
