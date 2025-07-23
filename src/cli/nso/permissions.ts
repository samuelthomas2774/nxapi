import { PlayLogPermissions, PresencePermissions } from '../../api/coral-types.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:permissions');

export const command = 'permissions';
export const desc = 'Get or update Nintendo Switch presence permissions';

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
    }).option('presence', {
        describe: 'New presence permission',
        type: 'string',
    }).option('play-activity', {
        describe: 'New play activity permission',
        type: 'string',
    }).option('friend-requests', {
        describe: 'New friend requests permission',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presence && !['FRIENDS', 'FAVORITE_FRIENDS', 'SELF'].includes(argv.presence)) {
        throw new Error('Invalid presence permissions');
    }
    if (argv.playActivity && !['EVERYONE', 'FRIENDS', 'FAVORITE_FRIENDS', 'SELF'].includes(argv.playActivity)) {
        throw new Error('Invalid play activity permissions');
    }
    if ('friendRequests' in argv && typeof argv.friendRequests !== 'boolean') {
        throw new Error('Invalid friend requests permissions');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [friends, chats, webservices, activeevent, media, announcements, current_user] = data[Login] || true ? await Promise.all([
        nso.getFriendList(),
        nso.getChats(),
        nso.getWebServices(),
        nso.getActiveEvent(),
        nso.getMedia(),
        nso.getAnnouncements(),
        nso.getCurrentUser(),
    ]) : [];

    const [current_user_2, play_log, permissions] = await Promise.all([
        nso.getCurrentUser(),
        nso.getPlayLog(data.nsoAccount.user.nsaId),
        nso.getCurrentUserPermissions(),
    ]);

    if (argv.presence || argv.playActivity || typeof argv.friendRequests === 'boolean') {
        if (argv.presence) {
            const permissions = await nso.getCurrentUserPermissions();

            await nso.updateUserPresencePermissions(argv.presence as PresencePermissions);
        }

        if (argv.playActivity) {
            const permissions = await nso.getCurrentUserPermissions();

            await nso.updateUserPlayLogPermissions(argv.playActivity as PlayLogPermissions);
        }

        if (typeof argv.friendRequests === 'boolean') {
            const permissions = await nso.getCurrentUserPermissions();

            await nso.updateUserFriendRequestPermissions(argv.friendRequests);
        }
    } else {
        if (argv.jsonPrettyPrint) {
            console.log(JSON.stringify(permissions, null, 4));
            return;
        }
        if (argv.json) {
            console.log(JSON.stringify(permissions));
            return;
        }

        console.log('Presence is visible to %s', permissions.permissions.presence);
        console.log('Play activity is visible to %s', permissions.permissions.playLog);
        console.log('Friend requests are ' + (permissions.permissions.friendRequestReception ? '' : 'not ') + 'allowed');
    }
}
