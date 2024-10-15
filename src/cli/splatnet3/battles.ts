import { Judgement } from 'splatnet3-types/splatnet3';
import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:splatnet3:battles');

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
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const results = await splatnet.getLatestBattleHistories();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(results.data, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(results.data));
        return;
    }

    console.log('Summary', results.data.latestBattleHistories.summary);

    const table = new Table({
        head: [
            'ID',
            'Mode',
            'Rule',
            'Stage',
            'Result',
        ],
    });

    for (const group of results.data.latestBattleHistories.historyGroups.nodes) {
        for (const result of group.historyDetails.nodes) {
            const match = Buffer.from(result.id, 'base64').toString().match(/^VsHistoryDetail-(u-[0-9a-z]{20}):RECENT:((\d+T\d+)_([0-9a-f-]+))$/);
            const id_str = match ? match[2] : result.id;

            table.push([
                id_str,
                (result.vsMode.mode === 'REGULAR' ? '\u001b[32m' :
                    // result.vsMode.mode === 'ranked' ? '\u001b[33m' :
                    // result.vsMode.mode === 'league' ? '\u001b[31m' :
                    // result.vsMode.mode === 'private' ? '\u001b[35m' :
                    '') +
                    result.vsMode.mode + '\u001b[0m',
                result.vsRule.name,
                result.vsStage.name,
                (result.judgement === Judgement.WIN ? '\u001b[32m' : '\u001b[31m') +
                    result.judgement + '\u001b[0m',
            ]);
        }
    }

    console.log(table.toString());
}
