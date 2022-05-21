import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';

const debug = createDebug('cli:splatnet2:battles');

export const command = 'battles';
export const desc = 'List the last 50 regular/ranked/private/festival battles';

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

    const results = await splatnet.getResults();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(results, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(results));
        return;
    }

    console.log('Summary', results.summary);

    const table = new Table({
        head: [
            '#',
            'Type',
            'Mode',
            'Rule',
            'Stage',
            'Result',
            'Inked',
            'K (A)',
            'D',
            'S',
            'Timestamp',
        ],
    });

    results.results.sort((a, b) => a.start_time > b.start_time ? 1 : a.start_time < b.start_time ? -1 : 0);

    for (const result of results.results) {
        table.push([
            result.battle_number,
            result.type,
            (result.game_mode.key === 'regular' ? '\u001b[32m' :
                result.game_mode.key === 'ranked' ? '\u001b[33m' :
                result.game_mode.key === 'league' ? '\u001b[31m' :
                result.game_mode.key === 'private' ? '\u001b[35m' : '') +
                result.game_mode.name + '\u001b[0m',
            result.rule.key,
            result.stage.name,
            (result.my_team_result.key === 'victory' ? '\u001b[32m' : '\u001b[31m') +
                result.my_team_result.name + '\u001b[0m',
            result.player_result.game_paint_point + 'p',
            result.player_result.kill_count + ' (' + result.player_result.assist_count + ')',
            result.player_result.death_count,
            result.player_result.special_count,
            new Date(result.start_time * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
}
