import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from './util.js';

const debug = createDebug('cli:splatnet2:schedule');

export const command = 'schedule';
export const desc = 'Show stage schedules';

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
    const {splatnet} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const schedules = await splatnet.getSchedules();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(schedules, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(schedules));
        return;
    }

    for (const [text, schedule] of [
        ['Regular Battle', schedules.regular],
        ['Ranked Battle', schedules.gachi],
        ['League Battle', schedules.league],
    ] as const) {
        const table = new Table({
            head: [
                'ID',
                'Start',
                'Rule',
                'Stage',
                'Stage',
            ],
        });

        for (const item of schedule) {
            table.push([
                item.id,
                new Date(item.start_time * 1000).toISOString(),
                item.rule.name,
                item.stage_a.name,
                item.stage_b.name,
            ]);
        }

        console.log(text);
        console.log(table.toString());
    }
}
