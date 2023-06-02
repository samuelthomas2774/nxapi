import type { Arguments as ParentArguments } from '../nso.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:friendcode');

export const command = 'friendcode';
export const desc = 'Get a friend code URL';

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
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    if (data[Login]) {
        const announcements = await nso.getAnnouncements();
        const friends = await nso.getFriendList();
        const webservices = await nso.getWebServices();
        const activeevent = await nso.getActiveEvent();
    }

    const friendcodeurl = await nso.getFriendCodeUrl();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(friendcodeurl, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(friendcodeurl));
        return;
    }

    console.warn('Friend code', friendcodeurl);
    console.log(friendcodeurl.url);
}
