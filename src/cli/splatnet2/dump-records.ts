import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';
import { dumpChallenges, dumpHeroRecords, dumpProfileImage, dumpRecords } from '../../common/splatnet2/dump-records.js';

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

    await fs.mkdir(directory, {recursive: true});

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
