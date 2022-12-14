import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import { BankaraBattleHistoriesRefetchResult, CoopHistoryResult, LatestBattleHistoriesRefetchResult, LatestBattleHistoriesResult, PrivateBattleHistoriesRefetchResult, RegularBattleHistoriesRefetchResult, RequestId, XBattleHistoriesRefetchResult } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api, { RequestIdSymbol } from '../../api/splatnet3.js';
import { ResponseSymbol } from '../../api/util.js';
import { dumpCatalogRecords, dumpHistoryRecords } from './dump-records.js';

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
    }).option('coop', {
        describe: 'Include coop (Salmon Run) results',
        type: 'boolean',
    }).option('include-history', {
        describe: 'Include history records',
        type: 'boolean',
        default: false,
    }).option('include-catalog', {
        describe: 'Include catalog records',
        type: 'boolean',
        default: false,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const _all = [argv.battles, argv.coop];
    const _default = !_all.find(f => f === true);

    if (!_all.some(f => f ?? _default)) {
        throw new Error('Enable one of --battles or --coop');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await mkdirp(directory);

    if (argv.battles ?? _default) {
        await dumpResults(splatnet, directory);
    }
    if (argv.coop ?? _default) {
        await dumpCoopResults(splatnet, directory);
    }

    if (argv.includeHistory) {
        await dumpHistoryRecords(splatnet, directory);
    }
    if (argv.includeCatalog) {
        await dumpCatalogRecords(splatnet, directory);
    }
}

export async function dumpResults(
    splatnet: SplatNet3Api, directory: string,
    refresh: LatestBattleHistoriesResult | boolean = false
) {
    debug('Fetching battle results');
    console.warn('Fetching battle results');

    const [player, battles, battles_regular, battles_anarchy, battles_xmatch, battles_private] = await Promise.all([
        refresh ? null : splatnet.getBattleHistoryCurrentPlayer(),
        refresh ? splatnet.getLatestBattleHistoriesRefetch() : splatnet.getLatestBattleHistories(),
        refresh ? splatnet.getRegularBattleHistoriesRefetch() : splatnet.getRegularBattleHistories(),
        refresh ? splatnet.getBankaraBattleHistoriesRefetch() : splatnet.getBankaraBattleHistories(),
        refresh ? splatnet.getXBattleHistoriesRefetch() : splatnet.getXBattleHistories(),
        refresh ? splatnet.getPrivateBattleHistoriesRefetch() : splatnet.getPrivateBattleHistories(),
    ]);

    const filename = 'splatnet3-results-summary-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        player: player ? {
            result: player.data.currentPlayer,
            query: player[RequestIdSymbol],
            be_version: player[ResponseSymbol].headers.get('x-be-version'),
        } : undefined,
        latestBattleHistories: {
            result: battles.data.latestBattleHistories,
            fest: battles.data.currentFest,
            player: 'currentPlayer' in battles.data ?
                (battles.data as LatestBattleHistoriesRefetchResult<true>).currentPlayer : undefined,
            query: battles[RequestIdSymbol],
            be_version: battles[ResponseSymbol].headers.get('x-be-version'),
        },
        regularBattleHistories: {
            result: battles_regular.data.regularBattleHistories,
            player: 'currentPlayer' in battles_regular.data ?
                (battles_regular.data as RegularBattleHistoriesRefetchResult<true>).currentPlayer : undefined,
            query: battles_regular[RequestIdSymbol],
            be_version: battles_regular[ResponseSymbol].headers.get('x-be-version'),
        },
        bankaraBattleHistories: {
            result: battles_anarchy.data.bankaraBattleHistories,
            player: 'currentPlayer' in battles_anarchy.data ?
                (battles_anarchy.data as BankaraBattleHistoriesRefetchResult<true>).currentPlayer : undefined,
            query: battles_anarchy[RequestIdSymbol],
            be_version: battles_anarchy[ResponseSymbol].headers.get('x-be-version'),
        },
        xBattleHistories: {
            result: battles_xmatch.data.xBattleHistories,
            player: 'currentPlayer' in battles_xmatch.data ?
                (battles_xmatch.data as XBattleHistoriesRefetchResult<true>).currentPlayer : undefined,
            query: battles_xmatch[RequestIdSymbol],
            be_version: battles_xmatch[ResponseSymbol].headers.get('x-be-version'),
        },
        privateBattleHistories: {
            result: battles_private.data.privateBattleHistories,
            player: 'currentPlayer' in battles_private.data ?
                (battles_private.data as PrivateBattleHistoriesRefetchResult<true>).currentPlayer : undefined,
            query: battles_private[RequestIdSymbol],
            be_version: battles_private[ResponseSymbol].headers.get('x-be-version'),
        },
        app_version: splatnet.version,
    }, null, 4) + '\n', 'utf-8');

    const downloaded = [];
    const latest_unique_ids = [];
    const skipped = [];

    // Reverse battle history order so oldest records are downloaded first
    for (const group of [...battles.data.latestBattleHistories.historyGroups.nodes].reverse()) {
        for (const item of [...group.historyDetails.nodes].reverse()) {
            const id_str = Buffer.from(item.id, 'base64').toString() || item.id;
            const match = id_str.match(/^VsHistoryDetail-(u-[0-9a-z]{20}):([A-Z]+):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
            const id = match ? match[1] + '-' + match[3] : id_str;

            latest_unique_ids.push(id);

            const filename = 'splatnet3-result-' + id + '-' + RequestId.VsHistoryDetailQuery + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
                skipped.push(item.id);
            } catch (err) {
                debug('Fetching battle result %s', id);
                console.warn('Fetching battle result %s', id);
                const result = await splatnet.getBattleHistoryDetail(item.id);
                const pager = await splatnet.getBattleHistoryDetailPagerRefetch(item.id);

                debug('Writing %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    result: result.data.vsHistoryDetail,
                    query: result[RequestIdSymbol],
                    app_version: splatnet.version,
                    be_version: result[ResponseSymbol].headers.get('x-be-version'),
                }, null, 4) + '\n', 'utf-8');

                downloaded.push(item.id);
            }
        }
    }

    for (const group of [
        ...battles_regular.data.regularBattleHistories.historyGroups.nodes,
        ...battles_anarchy.data.bankaraBattleHistories.historyGroups.nodes,
        ...battles_xmatch.data.xBattleHistories.historyGroups.nodes,
        ...battles_private.data.privateBattleHistories.historyGroups.nodes,
    ].reverse()) {
        for (const item of [...group.historyDetails.nodes].reverse()) {
            const id_str = Buffer.from(item.id, 'base64').toString() || item.id;
            const match = id_str.match(/^VsHistoryDetail-(u-[0-9a-z]{20}):([A-Z]+):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
            const id = match ? match[1] + '-' + match[3] : id_str;

            if (latest_unique_ids.includes(id)) continue;

            const filename = 'splatnet3-result-' + id + '-' + RequestId.VsHistoryDetailQuery + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
                skipped.push(item.id);
            } catch (err) {
                debug('Fetching battle result %s', id);
                console.warn('Fetching battle result %s', id);
                const result = await splatnet.getBattleHistoryDetail(item.id);
                const pager = await splatnet.getBattleHistoryDetailPagerRefetch(item.id);

                debug('Writing %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    result: result.data.vsHistoryDetail,
                    query: result[RequestIdSymbol],
                    app_version: splatnet.version,
                    be_version: result[ResponseSymbol].headers.get('x-be-version'),
                }, null, 4) + '\n', 'utf-8');

                downloaded.push(item.id);
            }
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped battle result %s, file already exists', skipped[0]);
        else debug('Skipped %d battle results, files already exist', skipped.length);
    }

    return {
        player,
        battles,
        battles_regular,
        battles_anarchy,
        battles_private,
        downloaded,
    };
}

export async function dumpCoopResults(
    splatnet: SplatNet3Api, directory: string,
    refresh: CoopHistoryResult | boolean = false
) {
    debug('Fetching coop results');
    console.warn('Fetching coop results');

    const results = refresh ?
        await splatnet.getCoopHistoryRefetch() :
        await splatnet.getCoopHistory();

    const filename = 'splatnet3-coop-summary-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.coopResult,
        query: results[RequestIdSymbol],
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');

    const downloaded = [];
    const skipped = [];

    // Reverse coop history order so oldest records are downloaded first
    for (const group of [...results.data.coopResult.historyGroups.nodes].reverse()) {
        for (const item of [...group.historyDetails.nodes].reverse()) {
            const id_str = Buffer.from(item.id, 'base64').toString() || item.id;
            const match = id_str.match(/^CoopHistoryDetail-(u-[0-9a-z]{20}):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
            const id = match ? match[1] + '-' + match[2] : id_str;

            const filename = 'splatnet3-coop-result-' + id + '-' + RequestId.CoopHistoryDetailQuery + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
                skipped.push(item.id);
            } catch (err) {
                debug('Fetching co-op history %s', id);
                console.warn('Fetching co-op history %s', id);
                const result = await splatnet.getCoopHistoryDetail(item.id);

                debug('Writing %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    result: result.data.coopHistoryDetail,
                    query: result[RequestIdSymbol],
                    app_version: splatnet.version,
                    be_version: result[ResponseSymbol].headers.get('x-be-version'),
                }, null, 4) + '\n', 'utf-8');

                downloaded.push(item.id);
            }
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped co-op result %s, file already exist', skipped[0]);
        else debug('Skipped %d co-op results, files already exist', skipped.length);
    }

    return {
        results,
        downloaded,
    };
}
