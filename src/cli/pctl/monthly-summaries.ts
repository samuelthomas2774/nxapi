import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import type { Arguments as ParentArguments } from '../../cli.js';
import { ArgumentsCamelCase, Argv, getPctlToken, initStorage, YargsArguments } from '../../util.js';

const debug = createDebug('cli:pctl:monthly-summaries');

export const command = 'monthly-summaries <device>';
export const desc = 'List monthly summaries';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('device', {
        describe: 'Nintendo Switch device ID',
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
        await storage.getItem('NintendoAccountToken-pctl.' + usernsid);
    const {moon, data} = await getPctlToken(storage, token);

    const summaries = await moon.getMonthlySummaries(argv.device);

    const table = new Table({
        head: [
            'Month',
        ],
    });

    for (const summary of summaries.items) {
        table.push([
            summary.month,
        ]);
    }

    console.log(table.toString());
}
