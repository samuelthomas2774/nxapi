import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getUserToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:reactions');

export const command = 'reactions';
export const desc = 'List all reactions available to the authenticated user/player';

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

    const emoticons = await nooklinkuser.getEmoticons();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(emoticons, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(emoticons));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Name',
        ],
    });

    for (const emoticon of emoticons.emoticons) {
        table.push([
            emoticon.label,
            emoticon.name,
        ]);
    }

    console.log(table.toString());
}
