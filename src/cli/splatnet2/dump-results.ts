import createDebug from 'debug';
import mkdirp from 'mkdirp';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from './util.js';
import SplatNet2Api from '../../api/splatnet2.js';
import { NicknameAndIcon } from '../../api/splatnet2-types.js';
import fetch from 'node-fetch';

const debug = createDebug('cli:splatnet2:dump-results');

export const command = 'dump-results <directory>';
export const desc = 'Download all battle and coop results';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('directory', {
        describe: 'Directory to write record data to',
        type: 'string',
        demandOption: true,
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
    const {splatnet} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateIksmSession);

    await mkdirp(argv.directory);

    const updated = argv.checkUpdated ? new Date((await splatnet.getRecords()).records.update_time * 1000) : undefined;

    const records = await splatnet.getRecords();

    if (argv.battles) {
        await dumpResults(splatnet, argv.directory, records.records.unique_id,
            argv.battleImages, argv.battleSummaryImage, updated);
    }
    if (argv.coop) {
        await dumpCoopResults(splatnet, argv.directory, records.records.unique_id, updated);
    }
}

export async function dumpResults(
    splatnet: SplatNet2Api, directory: string, user_id: string,
    images = false, summary_image = images, updated?: Date
) {
    const latest_filename = 'splatnet2-results-summary-' + user_id + '-latest.json';
    const latest_file = path.join(directory, latest_filename);

    if (updated) {
        try {
            const {timestamp} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            if (timestamp > updated.getTime()) {
                debug('Skipping battle results, user records not updated');
                return;
            }
        } catch (err) {}
    }

    debug('Fetching battle results');
    const results = await splatnet.getResults();

    const timestamp = Date.now();
    const summary_filename = 'splatnet2-results-summary-' + results.unique_id + '-' + timestamp + '.json';
    const summary_file = path.join(directory, summary_filename);

    debug('Writing summary %s', summary_filename);
    await fs.writeFile(summary_file, JSON.stringify(results, null, 4) + '\n', 'utf-8');

    if (summary_image) {
        const filename = 'splatnet2-results-summary-image-' + results.unique_id + '-' + timestamp + '.json';
        const file = path.join(directory, filename);
        const image_filename = 'splatnet2-results-summary-image-' + results.unique_id + '-' + timestamp + '.png';
        const image_file = path.join(directory, image_filename);

        debug('Fetching battle results summary image URL');
        const share = await splatnet.shareResultsSummary();

        debug('Fetching battle results summary image');
        const image_response = await fetch(share.url);
        const image = await image_response.buffer();

        debug('Writing battle results summary image data %s', filename);
        await fs.writeFile(file, JSON.stringify({
            share,
        }, null, 4) + '\n', 'utf-8');

        debug('Writing battle results summary image %s', filename);
        await fs.writeFile(image_file, image);
    }

    for (const item of results.results) {
        const filename = 'splatnet2-result-' + results.unique_id + '-' + item.battle_number + '-' + item.type + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            debug('Skipping battle result %d, file already exists', item.battle_number);
        } catch (err) {
            debug('Fetching battle result %d', item.battle_number);
            const result = await splatnet.getResult(item.battle_number);

            const nickname_and_icons: NicknameAndIcon[] = [];

            for (const playerresult of [result.player_result, ...result.my_team_members, ...result.other_team_members]) {
                const nickname_and_icon = await splatnet.getUserNicknameAndIcon([playerresult.player.principal_id]);
                nickname_and_icons.push(...nickname_and_icon.nickname_and_icons);
            }

            debug('Writing %s', filename);
            await fs.writeFile(file, JSON.stringify({
                result,
                nickname_and_icons,
            }, null, 4) + '\n', 'utf-8');
        }

        if (images) {
            const filename = 'splatnet2-result-image-' + results.unique_id + '-' +
                item.battle_number + '-' + item.type + '.json';
            const file = path.join(directory, filename);
            const image_filename = 'splatnet2-result-image-' + results.unique_id + '-' +
                item.battle_number + '-' + item.type + '.png';
            const image_file = path.join(directory, image_filename);

            try {
                await fs.stat(file);
                await fs.stat(image_file);
                debug('Skipping battle result image %d, file already exists', item.battle_number);
            } catch (err) {
                debug('Fetching battle results summary image URL');
                const share = await splatnet.shareResult(item.battle_number);

                debug('Fetching battle results summary image');
                const image_response = await fetch(share.url);
                const image = await image_response.buffer();

                debug('Writing battle results summary image data %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    share,
                }, null, 4) + '\n', 'utf-8');

                debug('Writing battle results summary image %s', filename);
                await fs.writeFile(image_file, image);
            }
        }
    }

    await fs.writeFile(latest_file, JSON.stringify({timestamp}, null, 4) + '\n', 'utf-8');
}

export async function dumpCoopResults(splatnet: SplatNet2Api, directory: string, user_id: string, updated?: Date) {
    const latest_filename = 'splatnet2-coop-summary-' + user_id + '-latest.json';
    const latest_file = path.join(directory, latest_filename);

    if (updated) {
        try {
            const {timestamp} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            if (timestamp > updated.getTime()) {
                debug('Skipping coop results, user records not updated');
                return;
            }
        } catch (err) {}
    }

    debug('Fetching coop results');
    const results = await splatnet.getCoopResults();

    const timestamp = Date.now();
    const summary_filename = 'splatnet2-coop-summary-' + user_id + '-' + Date.now() + '.json';
    const summary_file = path.join(directory, summary_filename);

    debug('Writing summary %s', summary_filename);
    await fs.writeFile(summary_file, JSON.stringify(results, null, 4) + '\n', 'utf-8');

    for (const item of results.results) {
        const filename = 'splatnet2-coop-result-' + user_id + '-' + item.job_id + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            debug('Skipping coop result %d, file already exists', item.job_id);
            continue;
        } catch (err) {}

        debug('Fetching coop result %d', item.job_id);
        const result = await splatnet.getCoopResult(item.job_id);

        const nickname_and_icons: NicknameAndIcon[] = [];

        for (const playerresult of [result.my_result, ...result.other_results]) {
            const nickname_and_icon = await splatnet.getUserNicknameAndIcon([playerresult.pid]);
            nickname_and_icons.push(...nickname_and_icon.nickname_and_icons);
        }

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify({
            result,
            nickname_and_icons,
        }, null, 4) + '\n', 'utf-8');
    }

    await fs.writeFile(latest_file, JSON.stringify({timestamp}, null, 4) + '\n', 'utf-8');
}
