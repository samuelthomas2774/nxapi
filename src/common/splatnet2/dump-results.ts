import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import fetch from 'node-fetch';
import SplatNet2Api from '../../api/splatnet2.js';
import { NicknameAndIcon } from '../../api/splatnet2-types.js';
import createDebug from '../../util/debug.js';
import { timeoutSignal } from '../../util/misc.js';

const debug = createDebug('nxapi:splatnet2:dump-results');

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

        debug('Writing battle results summary image data %s', filename);
        await fs.writeFile(file, JSON.stringify({
            share,
        }, null, 4) + '\n', 'utf-8');

        debug('Fetching battle results summary image', share);
        const [signal, cancel] = timeoutSignal();
        const image_response = await fetch(share.url, {
            headers: {
                'User-Agent': splatnet.useragent,
            },
            signal,
        }).finally(cancel);
        const image = await image_response.arrayBuffer();

        debug('Writing battle results summary image %s', filename);
        await fs.writeFile(image_file, Buffer.from(image));
    }

    const skipped = [];
    const skipped_images = [];

    for (const item of results.results) {
        const filename = 'splatnet2-result-' + results.unique_id + '-' + item.battle_number + '-' + item.type + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            skipped.push(item.battle_number);
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
                skipped_images.push(item.battle_number);
            } catch (err) {
                debug('Fetching battle results image URL');
                const share = await splatnet.shareResult(item.battle_number);

                debug('Writing battle results image data %s', filename);
                await fs.writeFile(file, JSON.stringify({
                    share,
                }, null, 4) + '\n', 'utf-8');

                debug('Fetching battle results image', share);
                const [signal, cancel] = timeoutSignal();
                const image_response = await fetch(share.url, {
                    headers: {
                        'User-Agent': splatnet.useragent,
                    },
                    signal,
                }).finally(cancel);
                const image = await image_response.arrayBuffer();

                debug('Writing battle results image %s', filename);
                await fs.writeFile(image_file, Buffer.from(image));
            }
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped battle result %d, file already exists', skipped[0]);
        else debug('Skipped battle results %s, files already exist', skipped.join(', '));
    }
    if (skipped_images.length) {
        if (skipped_images.length === 1) debug('Skipped battle result image %d, file already exists',
            skipped_images[0]);
        else debug('Skipped battle result images %s, files already exist', skipped_images.join(', '));
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

    const skipped = [];

    for (const item of results.results) {
        const filename = 'splatnet2-coop-result-' + user_id + '-' + item.job_id + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            skipped.push(item.job_id);
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

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped coop result %d, file already exists', skipped[0]);
        else debug('Skipped coop results %s, files already exist', skipped.join(', '));
    }

    await fs.writeFile(latest_file, JSON.stringify({timestamp}, null, 4) + '\n', 'utf-8');
}
