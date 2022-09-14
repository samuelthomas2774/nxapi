import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api from '../../api/splatnet3.js';

const debug = createDebug('cli:splatnet3:dump-results');

export const command = 'dump-results [directory]';
export const desc = 'Download all battle and coop results';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('directory', {
        describe: 'Directory to write record data to',
        type: 'string',
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('battles', {
        describe: 'Include regular/ranked/private/festival battle results',
        type: 'boolean',
        default: true,
    }).option('coop', {
        describe: 'Include coop (salmon run) results',
        type: 'boolean',
        default: true,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await mkdirp(directory);

    if (argv.battles) {
        await dumpResults(splatnet, directory);
    }
    if (argv.coop) {
        await dumpCoopResults(splatnet, directory);
    }
}

export async function dumpResults(
    splatnet: SplatNet3Api, directory: string
) {
    debug('Fetching battle results');
    const player = await splatnet.getBattleHistoryCurrentPlayer();
    const battles = await splatnet.getLatestBattleHistories();
    const battles_regular = await splatnet.getRegularBattleHistories();
    const battles_anarchy = await splatnet.getBankaraBattleHistories();
    const battles_private = await splatnet.getPrivateBattleHistories();

    const skipped = [];

    // Reverse battle history order so oldest records are downloaded first
    for (const group of battles.data.latestBattleHistories.historyGroups.nodes.reverse()) {
        for (const item of group.historyDetails.nodes.reverse()) {
            const id_str = Buffer.from(item.id, 'base64').toString() || item.id;

            const filename = 'splatnet3-result-' + id_str + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
                skipped.push(item.id);
            } catch (err) {
                debug('Fetching battle result %s', id_str);
                const result = await splatnet.getBattleHistoryDetail(item.id);
                const pager = await splatnet.getBattleHistoryDetailPagerRefetch(item.id);

                debug('Writing %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    result: result.data.vsHistoryDetail,
                }, null, 4) + '\n', 'utf-8');
            }
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped battle result %s, file already exists', skipped[0]);
        else debug('Skipped %d battle results, files already exist', skipped.length);
    }
}

export async function dumpCoopResults(splatnet: SplatNet3Api, directory: string) {
    debug('Fetching coop results');
    const results = await splatnet.getCoopHistory();

    const skipped = [];

    // Reverse coop history order so oldest records are downloaded first
    for (const group of results.data.coopResult.historyGroups.nodes.reverse()) {
        for (const item of group.historyDetails.nodes.reverse()) {
            const id_str = Buffer.from(item.id, 'base64').toString() || item.id;

            const filename = 'splatnet3-coopHistory-' + id_str + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
                skipped.push(item.id);
            } catch (err) {
                debug('Fetching co-op history %s', id_str);
                const result = await splatnet.getCoopHistoryDetail(item.id);

                debug('Writing %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    result: result.data.coopHistoryDetail,
                }, null, 4) + '\n', 'utf-8');
            }
        }
    }

    if (skipped.length) {
        debug('Skipped %d co-op history, files already exist', skipped.length);
    }
}
