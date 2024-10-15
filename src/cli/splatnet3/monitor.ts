import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import { dumpCatalogRecords, dumpHistoryRecords, dumpStageStats, dumpWeaponStats } from './dump-records.js';
import { dumpCoopResults, dumpResults } from './dump-results.js';
import { dumpAlbumPhotos } from './dump-album.js';
import SplatNet3Api from '../../api/splatnet3.js';

const debug = createDebug('cli:splatnet3:monitor');

export const command = 'monitor [directory]';
export const desc = 'Monitor SplatNet 3 for new battle and coop results and photo album items';

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
    }).option('album', {
        describe: 'Include photo album items',
        type: 'boolean',
    }).option('include-history', {
        describe: 'Include history records',
        type: 'boolean',
        default: false,
    }).option('include-catalog', {
        describe: 'Include catalog records',
        type: 'boolean',
        default: false,
    }).option('include-stage', {
        describe: 'Include stage stats',
        type: 'boolean',
        default: false,
    }).option('include-weapon', {
        describe: 'Include weapon stats',
        type: 'boolean',
        default: false,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        // 15 minutes
        default: 15 * 60,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const _all = [argv.battles, argv.coop, argv.album];
    const _default = !_all.find(f => f === true);

    if (!_all.some(f => f ?? _default)) {
        throw new Error('Enable one of --battles, --coop or --album');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await fs.mkdir(directory, {recursive: true});

    let vs: (ReturnType<typeof dumpResults> extends Promise<infer T> ? T : never) | null = null;
    let coop: (ReturnType<typeof dumpCoopResults> extends Promise<infer T> ? T : never) | null = null;
    let album: (ReturnType<typeof dumpAlbumPhotos> extends Promise<infer T> ? T : never) | null = null;

    if (argv.battles ?? _default) {
        vs = await dumpResults(splatnet, directory);
    }
    if (argv.coop ?? _default) {
        coop = await dumpCoopResults(splatnet, directory);
    }
    if (argv.album ?? _default) {
        album = await dumpAlbumPhotos(splatnet, directory);
    }

    if (argv.includeHistory) {
        await dumpHistoryRecords(splatnet, directory);
    }
    if (argv.includeCatalog) {
        await dumpCatalogRecords(splatnet, directory);
    }
    if (argv.includeStage) {
        await dumpStageStats(splatnet, directory);
    }
    if (argv.includeWeapon) {
        await dumpWeaponStats(splatnet, directory);
    }

    console.warn('Monitoring for new data');

    if (vs) {
        const latest_id = vs.battles.data.latestBattleHistories.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

        // If we already had the latest battle result, fetch it again now to match the behavour of Nintendo's app
        if (latest_id && !vs.downloaded.includes(latest_id)) {
            const id_str = Buffer.from(latest_id, 'base64').toString() || latest_id;
            const match = id_str.match(/^VsHistoryDetail-(u-[0-9a-z]{20}):([A-Z]+):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
            const id = match ? match[1] + '-' + match[3] : id_str;

            debug('Fetching latest battle result %s', id);
            const result = await splatnet.getBattleHistoryDetail(latest_id);
            const pager = await splatnet.getBattleHistoryDetailPagerRefetch(latest_id);
        }
    }

    if (coop) {
        const latest_id = coop.results.data.coopResult.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

        // If we already had the latest coop result, fetch it again now to match the behavour of Nintendo's app
        if (latest_id && !coop.downloaded.includes(latest_id)) {
            const id_str = Buffer.from(latest_id, 'base64').toString() || latest_id;
            const match = id_str.match(/^CoopHistoryDetail-(u-[0-9a-z]{20}):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
            const id = match ? match[1] + '-' + match[2] : id_str;

            debug('Fetching latest coop result %s', id);
            const result = await splatnet.getCoopHistoryDetail(latest_id);
        }
    }

    let updating = false;
    let should_exit = false;
    let sleep_timeout: NodeJS.Timeout | null = null;
    let sleep_resolve: ((value: void) => void) | null = null;

    const exit = () => {
        if (updating) {
            console.warn('Waiting for the current update to complete before exiting');
        }

        should_exit = true;
        sleep_resolve?.call(null);
        clearTimeout(sleep_timeout!);
        process.removeListener('SIGINT' as any, exit);
        process.removeListener('SIGTERM' as any, exit);
    };
    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);

    try {
        await new Promise(rs => sleep_timeout = setTimeout(sleep_resolve = rs, argv.updateInterval * 1000));

        while (!should_exit) {
            updating = true;
            [vs, coop, album] = await update(argv, splatnet, directory, vs, coop, album);
            updating = false;

            if (should_exit) continue;
            await new Promise(rs => sleep_timeout = setTimeout(sleep_resolve = rs, argv.updateInterval * 1000));
        }
    } finally {
        process.removeListener('SIGINT' as any, exit);
        process.removeListener('SIGTERM' as any, exit);
    }
}

async function update(
    argv: ArgumentsCamelCase<Arguments>,
    splatnet: SplatNet3Api,
    directory: string,
    vs: (ReturnType<typeof dumpResults> extends Promise<infer T> ? T : never) | null,
    coop: (ReturnType<typeof dumpCoopResults> extends Promise<infer T> ? T : never) | null,
    album: (ReturnType<typeof dumpAlbumPhotos> extends Promise<infer T> ? T : never) | null,
) {
    debug('Checking for new data');

    let updated_vs = false;
    let updated_coop = false;

    if (vs) {
        const latest_id = vs.battles.data.latestBattleHistories.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

        if (latest_id) {
            const pager = await splatnet.getBattleHistoryDetailPagerRefetch(latest_id);

            if (pager.data.vsHistoryDetail.nextHistoryDetail) {
                // New battle results available
                debug('New battle result', pager.data.vsHistoryDetail.nextHistoryDetail);
                vs = await dumpResults(splatnet, directory, vs.battles.data);
                updated_vs = true;
            }
        } else {
            const latest_refetch = await splatnet.getLatestBattleHistoriesRefetch();
            const latest_id = latest_refetch.data
                .latestBattleHistories.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

            if (latest_id) {
                debug('New battle result');
                vs = await dumpResults(splatnet, directory, vs.battles.data, latest_refetch);
                updated_vs = true;
            }
        }
    }

    if (coop) {
        const latest_id = coop.results.data.coopResult.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

        if (latest_id) {
            const pager = await splatnet.getCoopHistoryDetailRefetch(latest_id);

            if (pager.data.node.nextHistoryDetail) {
                // New coop results available
                debug('New coop result', pager.data.node.nextHistoryDetail);
                coop = await dumpCoopResults(splatnet, directory, coop.results.data);
                updated_coop = true;
            }
        } else {
            const refetch = await splatnet.getCoopHistoryRefetch();
            const latest_id = refetch.data.coopResult.historyGroups.nodes[0]?.historyDetails.nodes[0]?.id;

            if (latest_id) {
                debug('New coop result');
                coop = await dumpCoopResults(splatnet, directory, coop.results.data, refetch);
                updated_coop = true;
            }
        }
    }

    if (album) {
        await dumpAlbumPhotos(splatnet, directory, album);
    }

    if (argv.includeHistory && (updated_vs || updated_coop)) {
        await dumpHistoryRecords(splatnet, directory, true);
    }
    if (argv.includeCatalog && (updated_vs || updated_coop)) {
        await dumpCatalogRecords(splatnet, directory, true);
    }
    if (argv.includeStage && updated_vs) {
        await dumpStageStats(splatnet, directory, true);
    }
    if (argv.includeWeapon && updated_vs) {
        await dumpWeaponStats(splatnet, directory, true);
    }

    return [vs, coop, album] as const;
}
