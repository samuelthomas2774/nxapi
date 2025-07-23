import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:lookup');

export const command = 'lookup <id>';
export const desc = 'Lookup a user using their friend code';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('id', {
        describe: 'Friend code',
        type: 'string',
        demandOption: true,
    }).option('user', {
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

    const [fr_received, fr_sent] = await Promise.all([
        nso.getReceivedFriendRequests(),
        nso.getSentFriendRequests(),
    ]);

    const user = await nso.getUserByFriendCode(argv.id);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(user, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(user));
        return;
    }

    console.log('User', user);
}
