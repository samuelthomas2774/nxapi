import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { hrduration } from '../../util/misc.js';
import { getPctlToken } from '../../common/auth/moon.js';

const debug = createDebug('cli:pctl:daily-summaries');

export const command = 'daily-summaries <device>';
export const desc = 'Show daily summaries';

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

    const summaries = await moon.getDailySummaries(argv.device);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(summaries, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(summaries));
        return;
    }

    const table = new Table({
        head: [
            'Date',
            'Status',
            'Play time',
            'Misc. time',
            'Titles played',
            'Users played',
            'Notices',
        ],
    });

    for (const summary of summaries.items) {
        table.push([
            summary.date,
            summary.result,
            hrduration(summary.playingTime / 60, true),
            hrduration(summary.miscTime / 60, true),
            summary.playedApps.map(t => t.title).join('\n'),
            summary.devicePlayers.map(p => p.nickname)
                .concat(summary.anonymousPlayer ? ['Unknown user'] : []).join('\n'),
            [...summary.importantInfos, ...summary.observations.map(o => o.type)].join('\n'),
        ]);
    }

    console.log(table.toString());
}
