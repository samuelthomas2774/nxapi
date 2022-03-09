import Yargs from 'yargs';
import ZncApi, { AccountLogin, FlapgApiResponse, Game, NintendoAccountToken, NintendoAccountUser, Presence, PresenceState } from './api.js';
import persist from 'node-persist';
import * as path from 'path';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import DiscordRPC from 'discord-rpc';
import titles, { defaultTitle } from './titles.js';
import * as util from 'util';
import createDebug from 'debug';

const debug = createDebug('cli');

interface SavedToken {
    uuid: string;
    timestamp: string;
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;
    flapg: FlapgApiResponse['result'];
    credential: AccountLogin['webApiServerCredential'];

    expires_at: number;
}

async function initStorage(dir = path.join(import.meta.url.substr(7), '..', '..', 'data')) {
    const storage = persist.create({
        dir,
        stringify: data => JSON.stringify(data, null, 4) + '\n',
    });
    await storage.init();
    return storage;
}

async function getToken(storage: persist.LocalStorage, token: string) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `discord-switch-presence token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedToken | undefined = await storage.getItem('NsoToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        debug('Authenticating to znc with session token');

        const data = await ZncApi.createWithSessionToken(token);

        const existingToken: SavedToken = {
            ...data.data,
            expires_at: Date.now() + (data.data.credential.expiresIn * 1000),
        };

        await storage.setItem('NsoToken.' + token, existingToken);

        return data;
    }

    debug('Using existing token');

    return {
        nso: new ZncApi(existingToken.credential.accessToken),
        data: existingToken,
    };
}

const yargs = Yargs(process.argv.slice(2));

yargs.option('data-path', {
    describe: 'Data storage path',
    type: 'string',
    default: path.join(import.meta.url.substr(7), '..', '..', 'data'),
});

yargs.command('token [token]', 'Set the default Nintendo Account session token', yargs => {
    yargs.option('token', {
        describe: 'Nintendo Account session token (it is recommended this is not set and you enter it interactively)',
        type: 'string',
        requiresArg: false,
    });
    yargs.option('auth', {
        describe: 'Authenticate immediately',
        type: 'boolean',
        default: true,
    });
}, async argv => {
    // @ts-expect-error
    const storage = await initStorage(argv.dataPath);

    let token = argv.token as string | undefined;

    if (!token) {
        const read = await import('read');
        // @ts-expect-error
        const prompt = util.promisify(read.default as typeof read);

        token = await prompt({
            prompt: `Token: `,
            silent: true,
            output: process.stderr,
        });
    }

    await storage.setItem('SessionToken', token);

    if (argv.auth) {
        const {nso, data} = await getToken(storage, token);

        console.log('Authenticated as Nintendo Account %s (%s)', data.user.screenName, data.user.nickname);
    } else {
        console.log('Saved token');
    }
});

yargs.command('user', 'Get the authenticated Nintendo Account', yargs => {
    yargs.option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
        requiresArg: false,
    });
}, async argv => {
    // @ts-expect-error
    const storage = await initStorage(argv.dataPath);

    const token: string = (argv.token as string) || await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token);

    console.log('Nintendo Account', data.user);
});

yargs.command('friends', 'List Nintendo Switch friends', yargs => {
    yargs.option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
        requiresArg: false,
    });
}, async argv => {
    console.log('Listing friends');

    // @ts-expect-error
    const storage = await initStorage(argv.dataPath);

    const token: string = (argv.token as string) || await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token);

    const announcements = await nso.getAnnouncements();
    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();

    const table = new Table({
        head: [
            'ID',
            'NA ID',
            'Name',
            'Status',
            'Favourite?',
            'Added at',
        ],
    });

    for (const friend of friends.result.friends) {
        const hours = 'name' in friend.presence.game ? Math.floor(friend.presence.game.totalPlayTime / 60) : 0;
        const minutes = 'name' in friend.presence.game ? friend.presence.game.totalPlayTime - (hours * 60) : 0;

        table.push([
            friend.id,
            friend.nsaId,
            friend.name,
            friend.presence.state === PresenceState.ONLINE ?
                'name' in friend.presence.game ?
                    'Playing ' + friend.presence.game.name +
                        '; played for ' + (hours || !minutes ? hours + ' hour' + (hours === 1 ? '' : 's') : '') +
                        (minutes ? ', ' + minutes + ' minute' + (minutes === 1 ? '' : 's'): '') +
                        ' since ' + new Date(friend.presence.game.firstPlayedAt * 1000).toLocaleDateString('en-GB') :
                    'Online' :
                friend.presence.logoutAt ?
                    'Last seen ' + new Date(friend.presence.logoutAt * 1000).toISOString() :
                    'Offline',
            friend.isFavoriteFriend ? 'Yes' : 'No',
            new Date(friend.friendCreatedAt * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
});

function getDiscordPresence(game: Game): {
    id: string;
    title: string | undefined;
    presence: DiscordRPC.Presence;
    showTimestamp?: boolean;
} {
    const match = game.shopUri.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);

    const titleid = match?.[1];
    const title = titles.find(t => t.id === titleid) || defaultTitle;

    const hours = Math.floor(game.totalPlayTime / 60);
    const minutes = game.totalPlayTime - (hours * 60);

    const text = [];

    if (title.titleName === true) text.push(game.name);
    else if (title.titleName) text.push(title.titleName);

    if (hours >= 1) text.push('Played for ' + hours + ' hour' + (hours === 1 ? '' : 's') +
        (minutes ? ', ' + minutes + ' minute' + (minutes === 1 ? '' : 's'): '') +
        ' since ' + new Date(game.firstPlayedAt * 1000).toLocaleDateString('en-GB'));

    return {
        id: title.client || defaultTitle.client,
        title: titleid,
        presence: {
            details: text[0],
            state: text[1],
            largeImageKey: title.largeImageKey,
            smallImageKey: title.smallImageKey,
        },
        showTimestamp: title.showTimestamp,
    };
}

yargs.command('presence', 'Start Discord Rich Presence', yargs => {
    yargs.option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
        requiresArg: false,
    });
    yargs.option('friend-naid', {
        describe: 'Friend\'s Nintendo Account ID',
        type: 'string',
        requiresArg: false,
    });
}, async argv => {
    // @ts-expect-error
    const storage = await initStorage(argv.dataPath);

    const token: string = (argv.token as string) || await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token);

    let rpc: {client: DiscordRPC.Client, id: string} | null = null;
    let title: {id: string; since: number} | null = null;
    let i = 0;

    async function updatePresence(presence: Presence | null) {
        console.log('Presence', i++, presence);

        if (presence?.state === PresenceState.ONLINE && 'name' in presence.game) {
            const discordpresence = getDiscordPresence(presence.game);

            if (rpc && rpc.id !== discordpresence.id) {
                await rpc?.client.destroy();
                rpc = null;
            }

            if (!rpc) {
                const client = new DiscordRPC.Client({transport: 'ipc'});
                await client.connect(discordpresence.id);
                rpc = {client, id: discordpresence.id};
            }

            if (discordpresence.title) {
                if (discordpresence.title !== title?.id) {
                    title = {id: discordpresence.title, since: Date.now()};
                }

                if (discordpresence.showTimestamp) {
                    discordpresence.presence.startTimestamp = title.since;
                }
            } else {
                title = null;
            }

            rpc.client.setActivity(discordpresence.presence);
        }

        if (!presence || presence.state !== PresenceState.ONLINE || !('name' in presence.game)) {
            if (rpc) {
                await rpc.client.destroy();
                rpc = null;
            }

            title = null;
        }
    }

    const announcements = await nso.getAnnouncements();
    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();

    if (argv.friendNaid) {
        const friend = friends.result.friends.find(f => f.nsaId === argv.friendNaid);

        if (!friend) {
            throw new Error('User "' + argv.friendNaid + '" is not friends with this user');
        }

        await updatePresence(friend.presence);
    } else {
        const user = await nso.getCurrentUser();

        await updatePresence(user.result.presence);
    }

    await new Promise(rs => setTimeout(rs, 30000));

    while (true) {
        try {
            if (argv.friendNaid) {
                await nso.getActiveEvent();
                await nso.getFriendList();
                await nso.getWebServices();

                const friend = friends.result.friends.find(f => f.nsaId === argv.friendNaid);

                if (!friend) {
                    // Is the authenticated user no longer friends with this user?
                    await updatePresence(null);
                    continue;
                }

                await updatePresence(friend.presence);
            } else {
                const user = await nso.getCurrentUser();

                await updatePresence(user.result.presence);
            }

            await new Promise(rs => setTimeout(rs, 30000));
        } catch (err) {
            // @ts-expect-error
            if (err?.data?.status === 9404) {
                // Token expired
                debug('Renewing token');

                const data = await nso.renewToken(token);

                const existingToken: SavedToken = {
                    ...data,
                    expires_at: Date.now() + (data.credential.expiresIn * 1000),
                };

                await storage.setItem('NsoToken.' + token, existingToken);
            } else {
                throw err;
            }
        }
    }
});

yargs
    .scriptName('discord-switch-presence')
    .demandCommand()
    .help()
    // .version(false)
    .showHelpOnFail(false, 'Specify --help for available options');

export default yargs;
