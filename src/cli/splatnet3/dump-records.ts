import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api, { RequestIdSymbol } from '../../api/splatnet3.js';
import { ResponseSymbol } from '../../api/util.js';

const debug = createDebug('cli:splatnet3:dump-records');

export const command = 'dump-records [directory]';
export const desc = 'Download all player history/hero/catalog records and stage/weapon stats';

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
    }).option('catalog', {
        describe: 'Include catalog records',
        type: 'boolean',
    }).option('stage', {
        describe: 'Include stage stats',
        type: 'boolean',
    }).option('weapon', {
        describe: 'Include weapon stats',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const _all = [argv.history, argv.hero, argv.catalog, argv.stage, argv.weapon];
    const _default = !_all.find(f => f === true);

    if (!_all.some(f => f ?? _default)) {
        throw new Error('Enable one of --history, --hero, --catalog, --stage or --weapon');
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
    if (argv.catalog ?? _default) {
        await dumpCatalogRecords(splatnet, directory);
    }
    if (argv.stage ?? _default) {
        await dumpStageStats(splatnet, directory);
    }
    if (argv.weapon ?? _default) {
        await dumpWeaponStats(splatnet, directory);
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
        query: results[RequestIdSymbol],
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
        query: results[RequestIdSymbol],
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
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
        query: results[RequestIdSymbol],
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
        query: results[RequestIdSymbol],
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
        query: results[RequestIdSymbol],
        app_version: splatnet.version,
        be_version: results[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');
}
