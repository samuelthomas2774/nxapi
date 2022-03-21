import createDebug from 'debug';
import mkdirp from 'mkdirp';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from './util.js';
import SplatNet2Api, { ShareColour } from '../../api/splatnet2.js';
import { NicknameAndIcon } from '../../api/splatnet2-types.js';
import fetch from 'node-fetch';

const debug = createDebug('cli:splatnet2:dump-records');

export const command = 'dump-records <directory>';
export const desc = 'Download all other records';

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
    }).option('user-records', {
        describe: 'Include user records',
        type: 'boolean',
        default: true,
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
    }).option('hero-records', {
        describe: 'Include hero (Octo Canyon) records',
        type: 'boolean',
        default: true,
    }).option('timeline', {
        describe: 'Include timeline records',
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

    const [records, stages, activefestivals, timeline] = await Promise.all([
        splatnet.getRecords(),
        splatnet.getStages(),
        splatnet.getActiveFestivals(),
        splatnet.getTimeline(),
    ]);
    const nickname_and_icons = await splatnet.getUserNicknameAndIcon([records.records.player.principal_id]);

    if (argv.userRecords) {
        const filename = 'splatnet2-records-' + records.records.unique_id + '-' + Date.now() + '.json';
        const file = path.join(argv.directory, filename);

        debug('Writing records %s', filename);
        await fs.writeFile(file, JSON.stringify(records, null, 4) + '\n', 'utf-8');

        const ni_filename = 'splatnet2-ni-' + records.records.unique_id + '-' + Date.now() + '.json';
        const ni_file = path.join(argv.directory, ni_filename);

        debug('Writing records %s', ni_filename);
        await fs.writeFile(ni_file, JSON.stringify(nickname_and_icons.nickname_and_icons[0], null, 4) + '\n', 'utf-8');
    }

    if (argv.profileImage) {
        const filename = 'splatnet2-profile-' + records.records.unique_id + '-' + Date.now() + '.json';
        const file = path.join(argv.directory, filename);
        const image_filename = 'splatnet2-profile-' + records.records.unique_id + '-' + Date.now() + '.png';
        const image_file = path.join(argv.directory, image_filename);

        const stage = argv.favouriteStage ?
            stages.stages.find(s => s.id === argv.favouriteStage ||
                s.name.toLowerCase() === argv.favouriteStage?.toLowerCase()) :
            stages.stages[0];

        if (!stage) {
            debug('Invalid favourite stage "%s"', argv.favouriteStage);
        }

        // @ts-expect-error
        if (!Object.values(ShareColour).includes(argv.favouriteColour)) {
            argv.favouriteColour = ShareColour.PINK;
        }

        debug('Fetching profile image URL');
        const share = await splatnet.shareProfile(stage?.id ?? stages.stages[0].id, argv.favouriteColour as ShareColour);

        debug('Fetching profile image');
        const image_response = await fetch(share.url);
        const image = await image_response.buffer();

        debug('Writing profile image data %s', filename);
        await fs.writeFile(file, JSON.stringify({
            share,
            stage: stage ?? stages.stages[0],
            colour: argv.favouriteColour,
        }, null, 4) + '\n', 'utf-8');

        debug('Writing profile image %s', filename);
        await fs.writeFile(image_file, image);
    }

    if (argv.heroRecords) {
        debug('Fetching hero records');
        const hero = await splatnet.getHeroRecords();

        const filename = 'splatnet2-hero-' + records.records.unique_id + '-' + Date.now() + '.json';
        const file = path.join(argv.directory, filename);

        debug('Writing hero records %s', filename);
        await fs.writeFile(file, JSON.stringify(hero, null, 4) + '\n', 'utf-8');
    }

    if (argv.timeline) {
        const filename = 'splatnet2-timeline-' + records.records.unique_id + '-' + Date.now() + '.json';
        const file = path.join(argv.directory, filename);

        debug('Writing timeline %s', filename);
        await fs.writeFile(file, JSON.stringify(records, null, 4) + '\n', 'utf-8');
    }
}
