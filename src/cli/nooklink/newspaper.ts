import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nooklink.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getUserToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:newspaper');

export const command = 'newspaper [key]';
export const desc = 'Get a newspaper issue';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('key', {
        describe: 'Newspaper ID',
        type: 'string',
    }).option('user', {
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

    const newspaper = argv.key ?
        await nooklinkuser.getNewspaper(argv.key) :
        await nooklinkuser.getLatestNewspaper();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(newspaper, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(newspaper));
        return;
    }

    const table = new Table({
        head: [
            'Date',
            'Priority',
            'Type',
            'Attributes',
        ],
    });

    for (const article of newspaper.body.articles) {
        table.push([
            article.date,
            article.priority,
            article.label,
            article.attributes.map(at => {
                if (at.type === 'date') return at.type + ' ' + at.value;
                if (at.type === 'npc') return at.type + ' ' + at.value;
                if (at.type === 'item') return at.type + ' ' + at.value;
                if (at.type === 'rand') return at.type + ' ' + at.value;
                if (at.type === 'player') return at.type + ' ' + at.value;
                if (at.type === 'value') return at.type + ' ' + at.value;
                return (at as any).type;
            }).join('\n'),
        ]);
    }

    console.log('Articles');
    console.log(table.toString());
}
