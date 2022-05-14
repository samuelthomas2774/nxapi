import * as path from 'path';
import * as fs from 'fs/promises';
import createDebug from 'debug';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import SplatNet2Api, { ShareColour } from '../../api/splatnet2.js';
import { Challenge, NicknameAndIcon, Records, Stages } from '../../api/splatnet2-types.js';

const debug = createDebug('nxapi:splatnet2:dump-records');

export async function dumpRecords(
    directory: string, user_id: string,
    records: Records, nickname_and_icon: NicknameAndIcon,
    updated?: Date
) {
    const latest_filename = 'splatnet2-records-' + user_id + '-latest.json';
    const latest_file = path.join(directory, latest_filename);

    if (updated) {
        try {
            const {sn2_updated_timestamp} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            if ((sn2_updated_timestamp * 1000) >= updated.getTime()) {
                debug('Skipping user records, not updated');
                return;
            }
        } catch (err) {}
    }

    const timestamp = Date.now();
    const sn2_updated_timestamp = records.records.update_time;

    const filename = 'splatnet2-records-' + user_id + '-' + timestamp + '.json';
    const file = path.join(directory, filename);
    const ni_filename = 'splatnet2-ni-' + user_id + '-' + timestamp + '.json';
    const ni_file = path.join(directory, ni_filename);

    debug('Writing records %s', filename);
    await fs.writeFile(file, JSON.stringify(records, null, 4) + '\n', 'utf-8');

    debug('Writing records %s', ni_filename);
    await fs.writeFile(ni_file, JSON.stringify(nickname_and_icon, null, 4) + '\n', 'utf-8');

    await fs.writeFile(latest_file, JSON.stringify({timestamp, sn2_updated_timestamp}, null, 4) + '\n', 'utf-8');
}

export async function dumpProfileImage(
    splatnet: SplatNet2Api, directory: string, user_id: string,
    stages: Stages, nickname_and_icon: NicknameAndIcon,
    favourite_stage?: string, favourite_colour?: string,
    updated?: Date
) {
    const stage = favourite_stage ?
        stages.stages.find(s => s.id === favourite_stage ||
            s.name.toLowerCase() === favourite_stage?.toLowerCase()) :
        stages.stages[0];

    if (!stage) {
        debug('Invalid favourite stage "%s"', favourite_stage);
    }

    // @ts-expect-error
    if (!Object.values(ShareColour).includes(favourite_colour)) {
        favourite_colour = ShareColour.PINK;
    }

    const latest_filename = 'splatnet2-profile-' + user_id + '-latest.json';
    const latest_file = path.join(directory, latest_filename);

    const etag_data = {
        stage: (stage ?? stages.stages[0]).id,
        stage_image: (stage ?? stages.stages[0]).image,
        colour: favourite_colour,

        name: nickname_and_icon.nickname,
        image_url: nickname_and_icon.thumbnail_url,
    };
    const etag = crypto.createHash('sha256').update(JSON.stringify(etag_data)).digest('base64');

    if (updated) {
        try {
            const {timestamp, etag: prev_etag} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            if (timestamp > updated.getTime() && etag === prev_etag) {
                debug('Skipping profile image, not updated');
                return;
            }
        } catch (err) {}
    }

    const timestamp = Date.now();
    const filename = 'splatnet2-profile-' + user_id + '-' + timestamp + '.json';
    const file = path.join(directory, filename);
    const image_filename = 'splatnet2-profile-' + user_id + '-' + timestamp + '.png';
    const image_file = path.join(directory, image_filename);

    debug('Fetching profile image URL');
    const share = await splatnet.shareProfile(stage?.id ?? stages.stages[0].id, favourite_colour as ShareColour);

    debug('Fetching profile image');
    const image_response = await fetch(share.url);
    const image = await image_response.buffer();

    debug('Writing profile image data %s', filename);
    await fs.writeFile(file, JSON.stringify({
        share,
        stage: stage ?? stages.stages[0],
        colour: favourite_colour,
    }, null, 4) + '\n', 'utf-8');

    debug('Writing profile image %s', image_filename);
    await fs.writeFile(image_file, image);

    await fs.writeFile(latest_file, JSON.stringify({timestamp, etag, etag_data}, null, 4) + '\n', 'utf-8');
}

export async function dumpChallenges(
    splatnet: SplatNet2Api, directory: string, user_id: string,
    challenges: Challenge[], season: 1 | 2
) {
    for (const challenge of challenges) {
        const filename = 'splatnet2-challenge-' + user_id + '-' + challenge.key + '.json';
        const file = path.join(directory, filename);
        const image_filename = 'splatnet2-challenge-' + user_id + '-' + challenge.key + '.png';
        const image_file = path.join(directory, image_filename);

        try {
            await fs.stat(file);
            await fs.stat(image_file);
            debug('Skipping challenge image %s, file already exists', challenge.key);
            continue;
        } catch (err) {}

        debug('Fetching challenge image URL for %s', challenge.key);
        const share = await splatnet.shareChallenge(challenge.key, season);

        debug('Fetching challenge image for %s', challenge.key);
        const image_response = await fetch(share.url);
        const image = await image_response.buffer();

        debug('Writing challenge image data %s', filename);
        await fs.writeFile(file, JSON.stringify({share}, null, 4) + '\n', 'utf-8');

        debug('Writing challenge image %s', filename);
        await fs.writeFile(image_file, image);
    }
}

export async function dumpHeroRecords(splatnet: SplatNet2Api, directory: string, user_id: string) {
    debug('Fetching hero records');
    const hero = await splatnet.getHeroRecords();

    const filename = 'splatnet2-hero-' + user_id + '-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing hero records %s', filename);
    await fs.writeFile(file, JSON.stringify(hero, null, 4) + '\n', 'utf-8');
}
