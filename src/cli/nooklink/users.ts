import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getWebServiceToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:users');

export const command = 'users';
export const desc = 'List the authenticated user\'s NookLink enabled players';

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
    const {nooklink} = await getWebServiceToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const users = await nooklink.getUsers();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(users.users, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(users.users));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Name',
            'Island ID',
            'Island name',
        ],
    });

    for (const user of users.users) {
        table.push([
            user.id,
            user.name,
            user.land.id,
            user.land.name,
        ]);
    }

    console.log(table.toString());
}
