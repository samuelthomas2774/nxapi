import Table from '../../util/table.js';
import { PresencePlatform, PresenceState } from '../../api/coral-types.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { hrduration } from '../../util/misc.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:friends');

export const command = 'friends';
export const desc = 'List Nintendo Switch friends';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
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
    console.warn('Listing friends');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [friends, [chats, webservices, activeevent, media, announcements, current_user]] = await Promise.all([
        nso.getFriendList(),

        data[Login] || true ? Promise.all([
            nso.getChats(),
            nso.getWebServices(),
            nso.getActiveEvent(),
            nso.getMedia(),
            nso.getAnnouncements(),
            nso.getCurrentUser(),
        ]) : [],
    ]);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(friends.friends, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(friends.friends));
        return;
    }

    const table = new Table({
        head: [
            'Coral ID',
            'NSA ID',
            'Name',
            'Status',
            'Favourite?',
            'Added at',
        ],
    });

    for (const friend of friends.friends) {
        const online = friend.presence.state === PresenceState.ONLINE ||
            friend.presence.state === PresenceState.PLAYING;

        table.push([
            friend.id,
            friend.nsaId,
            friend.name,
            online ?
                'name' in friend.presence.game ?
                    'Playing ' + friend.presence.game.name +
                        ('platform' in friend.presence ?
                            friend.presence.platform === PresencePlatform.NX ? ' (Nintendo Switch)' :
                            friend.presence.platform === PresencePlatform.OUNCE ? ' (Nintendo Switch 2)' : '' : '') +
                        ';\nplayed for ' +
                        hrduration(friend.presence.game.totalPlayTime) + ' since ' +
                        new Date(friend.presence.game.firstPlayedAt * 1000).toISOString() :
                    'Online' :
                friend.presence.state === PresenceState.INACTIVE ?
                    'Console online' + (friend.presence.logoutAt ?
                        '; last seen ' + new Date(friend.presence.logoutAt * 1000).toISOString() : '') :
                friend.presence.logoutAt ?
                    'Last seen ' + new Date(friend.presence.logoutAt * 1000).toISOString() :
                'Offline',
            friend.isFavoriteFriend ? 'Yes' : 'No',
            new Date(friend.friendCreatedAt * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
}
