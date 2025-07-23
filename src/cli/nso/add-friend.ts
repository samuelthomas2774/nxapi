import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:add-friend');

export const command = 'add-friend <id>';
export const desc = 'Send a friend request using a user\'s friend code or NSA ID';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('id', {
        describe: 'Friend code or NSA ID',
        type: 'string',
        demandOption: true,
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    let nsa_id: string;

    if (/^\d{4}-\d{4}-\d{4}$/.test(argv.id)) {
        // Friend code

        const user = await nso.getUserByFriendCode(argv.id);
        nsa_id = user.nsaId;

        console.log('User', user);
    } else if (/^[0-9a-f]{16}$/.test(argv.id)) {
        // NSA ID
        nsa_id = argv.id;
    } else {
        throw new Error('Invalid ID');
    }

    if (nsa_id === data.nsoAccount.user.nsaId) {
        throw new Error('Cannot send a friend request to yourself');
    }

    const result = await nso.sendFriendRequest(nsa_id);

    debug('result', result);

    // Check if the user is now friends
    // This means the other user had already sent this user a friend request,
    // so sending them a friend request just accepted theirs
    const friends = await nso.getFriendList();
    const friend = friends.friends.find(f => f.nsaId === nsa_id);

    if (friend) {
        const play_log = await nso.getPlayLog(friend.nsaId);

        console.log('You are now friends with %s.', friend.name);
    } else {
        console.log('Friend request sent');
        console.log('The friend request can be accepted using a Nintendo Switch console, or by sending a friend request to your friend code: %s.', data.nsoAccount.user.links.friendCode.id);
    }
}
