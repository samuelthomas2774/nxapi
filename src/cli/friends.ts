import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import { PresenceState } from '../api/znc-types.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../util.js';

const debug = createDebug('cli:friends');

export const command = 'friends';
export const desc = 'List Nintendo Switch friends';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    console.log('Listing friends');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid) ||
        await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

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
        const online = friend.presence.state === PresenceState.ONLINE ||
            friend.presence.state === PresenceState.PLAYING;
        const hours = 'name' in friend.presence.game ? Math.floor(friend.presence.game.totalPlayTime / 60) : 0;
        const minutes = 'name' in friend.presence.game ? friend.presence.game.totalPlayTime - (hours * 60) : 0;

        table.push([
            friend.id,
            friend.nsaId,
            friend.name,
            online ?
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
}
