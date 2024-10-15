import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';
import { dumpCoopResults, dumpResults } from '../../common/splatnet2/dump-results.js';

const debug = createDebug('cli:splatnet2:dump-results');

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
    }).option('battle-summary-image', {
        describe: 'Include regular/ranked/private/festival battle summary image',
        type: 'boolean',
        default: false,
    }).option('battle-images', {
        describe: 'Include regular/ranked/private/festival battle result images',
        type: 'boolean',
        default: false,
    }).option('coop', {
        describe: 'Include coop (Salmon Run) results',
        type: 'boolean',
        default: true,
    }).option('check-updated', {
        describe: 'Only download data if user records have been updated',
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
    const {splatnet} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet2');

    await fs.mkdir(directory, {recursive: true});

    const updated = argv.checkUpdated ? new Date((await splatnet.getRecords()).records.update_time * 1000) : undefined;

    const records = await splatnet.getRecords();

    if (argv.battles) {
        await dumpResults(splatnet, directory, records.records.unique_id,
            argv.battleImages, argv.battleSummaryImage, updated);
    }
    if (argv.coop) {
        await dumpCoopResults(splatnet, directory, records.records.unique_id, updated);
    }
}
