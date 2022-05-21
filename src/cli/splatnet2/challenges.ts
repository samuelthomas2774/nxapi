import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';

const debug = createDebug('cli:splatnet2:challenges');

export const command = 'challenges';
export const desc = 'List lifetime inkage challenges';

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

    const records = await splatnet.getRecords();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(records.challenges, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(records.challenges));
        return;
    }

    for (const [text, season, challenges, next, total_paint_point] of [
        [
            'Lifetime inkage challenges season 1', 1,
            records.challenges.archived_challenges, records.challenges.next_challenge,
            records.challenges.total_paint_point,
        ] as const,
        [
            'Lifetime inkage challenges season 2 (Octoling)', 2,
            records.challenges.archived_challenges_octa, records.challenges.next_challenge_octa,
            records.challenges.total_paint_point_octa,
        ] as const,
    ]) {
        const table = new Table({
            head: [
                'ID',
                'Name',
                'Turf covered',
                'Completion',
            ],
        });

        for (const challenge of challenges) {
            table.push([
                challenge.key,
                challenge.name,
                challenge.paint_points + 'p',
                '100%',
            ]);
        }

        if (next) {
            table.push([
                '???',
                '???',
                next.paint_points + 'p',
                (Math.round((total_paint_point / next.paint_points) * 10000) / 100) + '%',
            ]);
        }

        console.log(text);
        console.log(table.toString());
    }
}
