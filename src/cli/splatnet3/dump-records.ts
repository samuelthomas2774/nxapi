import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import { FestState, Fest_detail, PhotoAlbumResult, RequestId } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api from '../../api/splatnet3.js';
import { ResponseSymbol } from '../../api/util.js';
import { timeoutSignal } from '../../util/misc.js';

const debug = createDebug('cli:splatnet3:dump-records');

export const command = 'dump-records [directory]';
export const desc = 'Download all player history/hero/fest/catalog records, stage/weapon stats and album photos';

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
    }).option('history', {
        describe: 'Include history records',
        type: 'boolean',
    }).option('hero', {
        describe: 'Include hero records',
        type: 'boolean',
    }).option('fest', {
        describe: 'Include fest records',
        type: 'boolean',
    }).option('fest-rankings', {
        describe: 'Include fest rankings (requires --fest)',
        type: 'boolean',
        default: false,
    }).option('catalog', {
        describe: 'Include catalog records',
        type: 'boolean',
    }).option('stage', {
        describe: 'Include stage stats',
        type: 'boolean',
    }).option('weapon', {
        describe: 'Include weapon stats',
        type: 'boolean',
    }).option('album', {
        describe: 'Include photo album',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const _all = [argv.history, argv.hero, argv.fest, argv.catalog, argv.stage, argv.weapon, argv.album];
    const _default = !_all.find(f => f === true);

    debug('default', _all, _default, _all.some(f => f ?? _default));

    if (!_all.some(f => f ?? _default)) {
        throw new Error('Enable one of --history, --hero, --fest, --catalog, --stage, --weapon or --album');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await mkdirp(directory);

    if (argv.history ?? _default) {
        await dumpHistoryRecords(splatnet, directory);
    }
    if (argv.hero ?? _default) {
        await dumpHeroRecords(splatnet, directory);
    }
    if (argv.fest ?? _default) {
        await dumpFestRecords(splatnet, directory, argv.festRankings);
    }
    if (argv.catalog ?? _default) {
        await dumpCatalogRecords(splatnet, directory);
    }
    if (argv.stage ?? _default) {
        await dumpStageStats(splatnet, directory);
    }
    if (argv.weapon ?? _default) {
        await dumpWeaponStats(splatnet, directory);
    }
    if (argv.album ?? _default) {
        await dumpAlbumPhotos(splatnet, directory);
    }
}

export async function dumpHistoryRecords(splatnet: SplatNet3Api, directory: string, refresh = false) {
    debug('Fetching history records');
    console.warn('Fetching history records');

    const results = refresh ?
        await splatnet.getHistoryRecordsRefetch() :
        await splatnet.getHistoryRecords();

    const filename = 'splatnet3-history-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.playHistory,
        player: results.data.currentPlayer,
        query: refresh ? RequestId.HistoryRecordRefetchQuery : RequestId.HistoryRecordQuery,
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}

export async function dumpHeroRecords(splatnet: SplatNet3Api, directory: string) {
    debug('Fetching hero records');
    console.warn('Fetching hero records');

    const results = await splatnet.getHeroRecords();

    const filename = 'splatnet3-hero-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.heroRecord,
        query: RequestId.HeroHistoryQuery,
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}

export async function dumpFestRecords(splatnet: SplatNet3Api, directory: string, include_rankings = false) {
    debug('Fetching fest records');
    console.warn('Fetching fest records');

    const records = await splatnet.getFestRecords();

    const filename = 'splatnet3-fests-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: records.data.festRecords,
        player: records.data.currentPlayer,
        query: RequestId.FestRecordQuery,
        app_version: splatnet.version,
        be_version: records[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');

    const skipped = [];

    for (const fest_record of [...records.data.festRecords.nodes].reverse()) {
        // Fest-EU:JUEA-00001
        const id_str = Buffer.from(fest_record.id, 'base64').toString() || fest_record.id;
        const match = id_str.match(/^Fest-([A-Z]{2}):(([A-Z]+)-(\d+))$/);
        const id = match ? match[1] + '-' + match[2] : id_str;

        const filename = 'splatnet3-fest-' + id + '-' +
            (fest_record.state !== FestState.CLOSED ? Date.now() + '-' : '') +
            RequestId.DetailFestRecordDetailQuery + '.json';
        const file = path.join(directory, filename);

        let record: Fest_detail | null = null;

        try {
            await fs.stat(file);
            // skipped.push(id);
        } catch (err) {
            debug('Fetching fest record %s', id);
            console.warn('Fetching fest record %s', id);

            const result = await splatnet.getFestDetail(fest_record.id);
            record = result.data.fest;

            debug('Writing %s', filename);
            await fs.writeFile(file, JSON.stringify({
                result: result.data.fest,
                player: result.data.currentPlayer,
                query: RequestId.DetailFestRecordDetailQuery,
                app_version: splatnet.version,
                be_version: result[ResponseSymbol].headers.get('x-be-version'),
            }, null, 4) + '\n', 'utf-8');
        }

        if (fest_record.state !== FestState.CLOSED) {
            const filename = 'splatnet3-festvotes-' + id + '-' + Date.now() + '-' +
                RequestId.DetailVotingStatusQuery + '.json';
            const file = path.join(directory, filename);

            // Fetch this now to match the behavour of Nintendo's app
            // If state !== closed it shouldn't be possible to get here
            if (!record) {
                const result = await splatnet.getFestDetail(fest_record.id);
                record = result.data.fest;
            }

            debug('Fetching fest voting status %s', id);
            console.warn('Fetching fest voting status %s', id);
            const result = await splatnet.getFestVotingStatus(fest_record.id);

            debug('Writing %s', filename);
            await fs.writeFile(file, JSON.stringify({
                result: result.data.fest,
                query: RequestId.DetailVotingStatusQuery,
                app_version: splatnet.version,
                be_version: result[ResponseSymbol].headers.get('x-be-version'),
            }, null, 4) + '\n', 'utf-8');
        }

        if (include_rankings) {
            const filename = 'splatnet3-festranking-' + id + '-' + RequestId.DetailRankingQuery + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
            } catch (err) {
                // Fetch this now to match the behavour of Nintendo's app
                if (!record) {
                    const result = await splatnet.getFestDetail(fest_record.id);
                    record = result.data.fest;
                }

                const rankings_available = record.state === FestState.CLOSED &&
                    !!record.teams[0].result;

                if (rankings_available) {
                    debug('Fetching fest rankings %s', id);
                    console.warn('Fetching fest rankings %s', id);
                    const result = await splatnet.getFestRanking(fest_record.id);

                    debug('Writing %s', filename);
                    await fs.writeFile(file, JSON.stringify({
                        result: result.data.fest,
                        query: RequestId.DetailFestRecordDetailQuery,
                        app_version: splatnet.version,
                        be_version: result[ResponseSymbol].headers.get('x-be-version'),
                    }, null, 4) + '\n', 'utf-8');
                } else {
                    debug('Skipping downloading rankings for %s, not yet available', id);
                }
            }
        }

        if (!record) {
            skipped.push(id);
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped fest %s, file already exists', skipped[0]);
        else debug('Skipped %d fests, files already exist', skipped.length);
    }
}

export async function dumpCatalogRecords(splatnet: SplatNet3Api, directory: string, refresh = false) {
    debug('Fetching catalog records');
    console.warn('Fetching catalog records');

    const results = refresh ?
        await splatnet.getCatalogRefetch() :
        await splatnet.getCatalog();

    const filename = 'splatnet3-catalog-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.catalog,
        query: refresh ? RequestId.CatalogRefetchQuery : RequestId.CatalogQuery,
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}

export async function dumpStageStats(splatnet: SplatNet3Api, directory: string, refresh = false) {
    debug('Fetching stage stats');
    console.warn('Fetching stage stats');

    const results = refresh ?
        await splatnet.getStageRecordsRefetch() :
        await splatnet.getStageRecords();

    const filename = 'splatnet3-stages-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.stageRecords,
        query: refresh ? RequestId.StageRecordsRefetchQuery : RequestId.StageRecordQuery,
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}

export async function dumpWeaponStats(splatnet: SplatNet3Api, directory: string, refresh = false) {
    debug('Fetching weapon stats');
    console.warn('Fetching weapon stats');

    const results = refresh ?
        await splatnet.getWeaponRecordsRefetch() :
        await splatnet.getWeaponRecords();

    const filename = 'splatnet3-weapons-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: results.data.weaponRecords,
        query: refresh ? RequestId.WeaponRecordsRefetchQuery : RequestId.WeaponRecordQuery,
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}

export async function dumpAlbumPhotos(
    splatnet: SplatNet3Api, directory: string,
    refresh: PhotoAlbumResult | boolean = false
) {
    debug('Fetching photo album items');
    console.warn('Fetching photo album items');

    const results = refresh ?
        await splatnet.getPhotoAlbumRefetch() :
        await splatnet.getPhotoAlbum();

    if (typeof refresh !== 'object' ||
        results.data.photoAlbum.items.nodes[0].id !== refresh.photoAlbum.items.nodes[0].id
    ) {
        const filename = 'splatnet3-photoalbum-' + Date.now() + '.json';
        const file = path.join(directory, filename);

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify({
            result: results.data.photoAlbum,
            query: refresh ? RequestId.PhotoAlbumRefetchQuery : RequestId.PhotoAlbumQuery,
            app_version: splatnet.version,
            be_version: results[ResponseSymbol].headers.get('x-be-version'),
        }, null, 4) + '\n', 'utf-8');
    }

    for (const item of [...results.data.photoAlbum.items.nodes].reverse()) {
        const id_str = Buffer.from(item.id, 'base64').toString() || item.id;
        const match = id_str.match(/^PhotoAlbumItem-(\d+)$/);
        const id = match ? match[1] : id_str;

        const thumbnail_filename = 'splatnet3-photothumbnail-' + id + '.jpeg';
        const thumbnail_file = path.join(directory, thumbnail_filename);

        try {
            await fs.stat(thumbnail_file);
        } catch (err) {
            debug('Fetching photo thumbnail %s', id, item.uploadedTime);
            console.warn('Fetching photo thumbnail %s', id, item.uploadedTime);

            const [signal, cancel] = timeoutSignal();
            const response = await fetch(item.thumbnail.url, {
                headers: {
                    'User-Agent': splatnet.useragent,
                },
                signal,
            }).finally(cancel);
            const data = new Uint8Array(await response.arrayBuffer());

            debug('Writing %s', thumbnail_filename);
            await fs.writeFile(thumbnail_file, data);
        }

        const filename = 'splatnet3-photo-' + id + '.jpeg';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
        } catch (err) {
            debug('Fetching photo %s', id, item.uploadedTime);
            console.warn('Fetching photo %s', id, item.uploadedTime);

            const [signal, cancel] = timeoutSignal();
            const response = await fetch(item.photo.url, {
                headers: {
                    'User-Agent': splatnet.useragent,
                },
                signal,
            }).finally(cancel);
            const data = new Uint8Array(await response.arrayBuffer());

            debug('Writing %s', filename);
            await fs.writeFile(file, data);
        }
    }

    return results.data;
}
