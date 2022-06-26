import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { getAllSeasons } from '../../api/splatnet2-xrank.js';

const debug = createDebug('cli:splatnet2:x-rank-seasons');

export const command = 'x-rank-seasons';
export const desc = 'Show X Rank seasons';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('sort', {
        describe: 'Sort',
        type: 'string',
        choices: ['asc', 'desc'],
        default: 'asc',
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
    const sort_ascending = argv.sort !== 'desc';

    if (argv.json || argv.jsonPrettyPrint) {
        const result = {
            seasons: [...getAllSeasons()],
        };

        console.log(JSON.stringify(result, null, argv.jsonPrettyPrint ? 4 : 0));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Key',
            'Start',
            'End',
            'Status',
        ],
    });

    for (const season of getAllSeasons(sort_ascending)) {
        table.push([
            season.id,
            season.key,
            season.start.toLocaleString('en-GB'),
            season.end.toLocaleString('en-GB'),
            season.complete ? 'Complete' : 'Calculating',
        ]);
    }

    console.log(table.toString());
}
