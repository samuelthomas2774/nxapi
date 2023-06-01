import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nooklink.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getUserToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:newspapers');

export const command = 'newspapers';
export const desc = 'List all newspaper issues';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
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
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl, argv.autoUpdateSession);

    const latest = await nooklinkuser.getLatestNewspaper();
    const newspapers = await nooklinkuser.getNewspapers();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(newspapers, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(newspapers));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Type',
            'Start date',
            'End date',
        ],
    });

    for (const newspaper of newspapers.newspapers) {
        table.push([
            newspaper.findKey + (newspaper.findKey === latest.findKey ? ' *' : ''),
            newspaper.type,
            newspaper.beginDate,
            newspaper.endDate,
        ]);
    }

    console.log(table.toString());
}
