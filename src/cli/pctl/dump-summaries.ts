import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Arguments as ParentArguments } from '../pctl.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getPctlToken } from '../../common/auth/moon.js';
import { DailySummaryResult } from '../../api/moon-types.js';
import MoonApi from '../../api/moon.js';

const debug = createDebug('cli:pctl:dump-summaries');

export const command = 'dump-summaries [directory]';
export const desc = 'Download all daily and monthly summaries';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('directory', {
        describe: 'Directory to write summary data to',
        type: 'string',
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('device', {
        describe: 'Nintendo Switch device ID',
        type: 'array',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken-pctl.' + usernsid);
    const {moon, data} = await getPctlToken(storage, token);

    const directory = argv.directory ?? path.join(argv.dataPath, 'summaries');

    await fs.mkdir(directory, {recursive: true});

    const devices = await moon.getDevices();

    for (const id of argv.device ?? []) {
        if (!devices.items.find(d => d.deviceId === id)) {
            console.warn('Device %s does not exist or is not linked to the authenticated user');
        }
    }

    for (const device of devices.items) {
        if (argv.device && !argv.device.includes(device.deviceId)) continue;

        console.warn('Downloading summaries for device %s (%s)', device.label, device.deviceId);

        const monthly = await dumpMonthlySummariesForDevice(moon, directory, device.deviceId);
        const daily = await dumpDailySummariesForDevice(moon, directory, device.deviceId);

        console.warn('Downloaded %d monthly and %d daily summaries for device %s (%s)',
            monthly.length, daily.length, device.label, device.deviceId);
    }
}

async function dumpMonthlySummariesForDevice(moon: MoonApi, directory: string, device: string) {
    debug('Fetching monthly summaries for device %s', device);
    const monthlySummaries = await moon.getMonthlySummaries(device);

    const downloaded = [];
    const skipped = [];

    for (const item of monthlySummaries.items) {
        const filename = 'pctl-monthly-' + item.deviceId + '-' + item.month + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            skipped.push(item.month);
            continue;
        } catch (err) {}

        debug('Fetching monthly summary %s for device %s', item.month, item.deviceId);
        console.warn('Fetching monthly summary %s for device %s', item.month, item.deviceId);
        const summary = await moon.getMonthlySummary(item.deviceId, item.month);

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify(summary, null, 4) + '\n', 'utf-8');

        downloaded.push(item.month);
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped monthly summary %s for device %s, file already exists', skipped[0], device);
        else debug('Skipped monthly summaries %s for device %s, files already exist', skipped.join(', '), device);
    }

    return downloaded;
}

async function dumpDailySummariesForDevice(moon: MoonApi, directory: string, device: string) {
    debug('Fetching daily summaries for device %s', device);
    const summaries = await moon.getDailySummaries(device);
    const timestamp = Date.now();

    const downloaded = [];
    const skipped = [];

    for (const summary of summaries.items) {
        const filename = 'pctl-daily-' + summary.deviceId + '-' + summary.date +
            (summary.result === DailySummaryResult.ACHIEVED ? '' : '-' + timestamp) + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            skipped.push(summary.date);
            continue;
        } catch (err) {}

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify(summary, null, 4) + '\n', 'utf-8');

        downloaded.push(summary.date);
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped daily summary %s for device %s, file already exists', skipped[0], device);
        else debug('Skipped daily summaries %s for device %s, files already exist', skipped.join(', '), device);
    }

    return downloaded;
}
