import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:splatnet3:festivals');

export const command = 'festivals';
export const desc = 'List all Splatfests in your region';

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
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const fest_records = await splatnet.getFestRecords();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify({festRecords: fest_records.data.festRecords.nodes}, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify({festRecords: fest_records.data.festRecords.nodes}));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'State',
            'Start',
            // 'L',
            'Title',
            'A',
            'B',
            'C',
        ],
    });

    for (const fest of fest_records.data.festRecords.nodes) {
        const id_str = Buffer.from(fest.id, 'base64').toString() || fest.id;

        table.push([
            id_str,
            fest.state,
            fest.startTime,
            // fest.lang,
            fest.title,
            ...fest.teams.map(t => t.teamName),
        ]);
    }

    console.log(table.toString());
}
