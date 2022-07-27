import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/nso.js';

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

    const user = await nso.getUserByFriendCode(argv.id);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(user.result, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(user.result));
        return;
    }

    console.log('User', user.result);
}
