import createDebug from 'debug';
import mkdirp from 'mkdirp';
import * as fs from 'fs/promises';
import * as path from 'path';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from './util.js';
import SplatNet2Api, { ShareColour } from '../../api/splatnet2.js';
import { Challenge, NicknameAndIcon, Records, Stages } from '../../api/splatnet2-types.js';

const debug = createDebug('cli:splatnet2:dump-records');

export const command = 'dump-records [directory]';
export const desc = 'Download all other records';

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
    }).option('user-records', {
        describe: 'Include user records',
        type: 'boolean',
        default: true,
    }).option('challenges', {
        describe: 'Include lifetime inkage challenges',
        type: 'boolean',
        default: false,
    }).option('profile-image', {
        describe: 'Include profile image',
        type: 'boolean',
        default: false,
    }).option('favourite-stage', {
        describe: 'Favourite stage to include on profile image',
        type: 'string',
    }).option('favourite-colour', {
        describe: 'Favourite colour to include on profile image',
        type: 'string',
    }).option('new-records', {
        describe: 'Only update user records and profile image if new data is available',
        type: 'boolean',
        default: true,
    }).option('hero-records', {
        describe: 'Include hero (Octo Canyon) records',
        type: 'boolean',
        default: false,
    }).option('timeline', {
        describe: 'Include timeline records',
        type: 'boolean',
        default: false,
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

    await mkdirp(directory);

    const [records, stages, activefestivals, timeline] = await Promise.all([
        splatnet.getRecords(),
        splatnet.getStages(),
        splatnet.getActiveFestivals(),
        splatnet.getTimeline(),
    ]);
    const nickname_and_icons = await splatnet.getUserNicknameAndIcon([records.records.player.principal_id]);

    const updated = argv.newRecords ? new Date(records.records.update_time * 1000) : undefined;

    if (argv.userRecords) {
        await dumpRecords(directory, records.records.unique_id, records,
            nickname_and_icons.nickname_and_icons[0], updated);
    }

    if (argv.profileImage) {
        await dumpProfileImage(splatnet, directory, records.records.unique_id, stages,
            nickname_and_icons.nickname_and_icons[0],
            argv.favouriteStage, argv.favouriteColour, updated);
    }

    if (argv.challenges) {
        await dumpChallenges(splatnet, directory, records.records.unique_id,
            records.challenges.archived_challenges, 1);
        await dumpChallenges(splatnet, directory, records.records.unique_id,
            records.challenges.archived_challenges_octa, 2);
    }

    if (argv.heroRecords) {
        await dumpHeroRecords(splatnet, directory, records.records.unique_id);
    }

    if (argv.timeline) {
        const filename = 'splatnet2-timeline-' + records.records.unique_id + '-' + Date.now() + '.json';
        const file = path.join(directory, filename);

        debug('Writing timeline %s', filename);
        await fs.writeFile(file, JSON.stringify(timeline, null, 4) + '\n', 'utf-8');
    }
}

export async function dumpRecords(
    directory: string, user_id: string,
    records: Records, nickname_and_icon: NicknameAndIcon,
    updated?: Date
) {
    const latest_filename = 'splatnet2-records-' + user_id + '-latest.json';
    const latest_file = path.join(directory, latest_filename);

    if (updated) {
        try {
            const {timestamp} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            if (timestamp > updated.getTime()) {
                debug('Skipping user records, not updated');
                return;
            }
        } catch (err) {}
    }

    const timestamp = Date.now();
    const filename = 'splatnet2-records-' + user_id + '-' + timestamp + '.json';
    const file = path.join(directory, filename);
    const ni_filename = 'splatnet2-ni-' + user_id + '-' + timestamp + '.json';
    const ni_file = path.join(directory, ni_filename);

    debug('Writing records %s', filename);
    await fs.writeFile(file, JSON.stringify(records, null, 4) + '\n', 'utf-8');

    debug('Writing records %s', ni_filename);
    await fs.writeFile(ni_file, JSON.stringify(nickname_and_icon, null, 4) + '\n', 'utf-8');

    await fs.writeFile(latest_file, JSON.stringify({timestamp}, null, 4) + '\n', 'utf-8');
}

export async function dumpProfileImage(
    splatnet: SplatNet2Api, directory: string, user_id: string,
    stages: Stages, nickname_and_icon: NicknameAndIcon,
    favourite_stage?: Arguments['favourite-stage'], favourite_colour?: Arguments['favourite-colour'],
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

async function dumpChallenges(
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

async function dumpHeroRecords(splatnet: SplatNet2Api, directory: string, user_id: string) {
    debug('Fetching hero records');
    const hero = await splatnet.getHeroRecords();

    const filename = 'splatnet2-hero-' + user_id + '-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing hero records %s', filename);
    await fs.writeFile(file, JSON.stringify(hero, null, 4) + '\n', 'utf-8');
}
