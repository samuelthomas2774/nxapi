import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getPctlToken } from '../../common/auth/moon.js';

const debug = createDebug('cli:pctl:monthly-summary');

export const command = 'monthly-summary <device> <month>';
export const desc = 'Show monthly summary data';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('device', {
        describe: 'Nintendo Switch device ID',
        type: 'string',
        demandOption: true,
    }).positional('month', {
        describe: 'Report month',
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
        await storage.getItem('NintendoAccountToken-pctl.' + usernsid);
    const {moon, data} = await getPctlToken(storage, token);

    const summary = await moon.getMonthlySummary(argv.device, argv.month);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(summary, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(summary));
        return;
    }

    const titles = new Table({
        head: [
            'Title',
            'First played',
            'Days',
            'Ranking',
        ],
    });

    for (const title of summary.playedApps) {
        titles.push([
            title.title,
            title.firstPlayDate,
            title.playingDays,
            title.position,
        ]);
    }

    console.log(titles.toString());
}
