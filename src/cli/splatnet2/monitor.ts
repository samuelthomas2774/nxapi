import * as path from 'path';
import createDebug from 'debug';
import { getIksmToken } from '../../common/auth/splatnet2.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { Arguments as ParentArguments } from '../splatnet2.js';
import { SplatNet2RecordsMonitor } from '../../common/splatnet2/monitor.js';

const debug = createDebug('cli:splatnet2:monitor');

export const command = 'monitor [directory]';
export const desc = 'Monitor SplatNet 2 for new user records/battles/Salmon Run results';

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
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        // 15 minutes to match splatnet2statink
        // When used with `nxapi nso notify/presence` this is 3 minutes by default, as the monitor is only
        // updated when playing Splatoon 2 online
        default: 15 * 60,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const records = await splatnet.getRecords();
    const stages = await splatnet.getStages();

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet2');
    const i = new SplatNet2RecordsMonitor(storage, token, splatnet, stages, directory, argv.zncProxyUrl);

    i.update_interval = argv.updateInterval;

    i.profile_image = argv.profileImage;
    i.favourite_stage = argv.favouriteStage;
    i.favourite_colour = argv.favouriteColour;

    i.results = argv.battles;
    i.results_summary_image = argv.battleSummaryImage;
    i.result_images = argv.battleImages;
    i.coop_results = argv.coop;

    i.cached_records = records;

    i.auto_update_iksm_session = argv.autoUpdateSession;

    console.log('Player %s (Splatoon 2 ID %s, NSA ID %s) level %d',
        records.records.player.nickname,
        records.records.unique_id,
        records.records.player.principal_id,
        records.records.player.player_rank,
        records.records.player.player_type);

    await i.loop(true);

    while (true) {
        await i.loop();
    }
}
