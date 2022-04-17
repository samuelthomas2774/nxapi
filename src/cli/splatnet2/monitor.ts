import createDebug from 'debug';
import persist from 'node-persist';
import mkdirp from 'mkdirp';
import * as fs from 'fs/promises';
import * as path from 'path';
import SplatNet2Api from '../../api/splatnet2.js';
import { getIksmToken, renewIksmToken } from './util.js';
import { ArgumentsCamelCase, Argv, initStorage, Loop, LoopResult, YargsArguments } from '../../util.js';
import { Records, Stages, WebServiceError } from '../../api/splatnet2-types.js';
import { Arguments as ParentArguments } from '../splatnet2.js';
import { dumpCoopResults, dumpResults } from './dump-results.js';
import { dumpProfileImage, dumpRecords } from './dump-records.js';
import { ErrorResponse } from '../../api/util.js';

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

export class SplatNet2RecordsMonitor extends Loop {
    update_interval: number = 3 * 60; // 3 minutes in seconds

    profile_image = true;
    favourite_stage: string | undefined = undefined;
    favourite_colour: string | undefined = undefined;

    results = true;
    results_summary_image = true;
    result_images = true;
    coop_results = true;

    /** Prevents redownloading user records on the first loop run */
    cached_records: Records | null = null;

    auto_update_iksm_session = true;

    constructor(
        public storage: persist.LocalStorage,
        public token: string,
        public splatnet: SplatNet2Api,
        public stages: Stages,
        public directory: string,
        public znc_proxy_url?: string
    ) {
        super();
    }

    async init() {
        await mkdirp(this.directory);
    }

    async hasChanged(records: Records) {
        const latest_filename = 'splatnet2-records-' + records.records.unique_id + '-latest.json';
        const latest_file = path.join(this.directory, latest_filename);

        const updated = new Date(records.records.update_time * 1000);

        try {
            const {sn2_updated_timestamp} = JSON.parse(await fs.readFile(latest_file, 'utf-8'));

            return (sn2_updated_timestamp * 1000) < updated.getTime();
        } catch (err) {}

        return true;
    }

    async update() {
        const records = this.cached_records ?? await this.splatnet.getRecords();
        this.cached_records = null;

        if (!(await this.hasChanged(records))) {
            debug('No data changed');
            return;
        }

        const nickname_and_icons = await this.splatnet.getUserNicknameAndIcon([records.records.player.principal_id]);

        // This will also update the splatnet2-records-...-latest.json file
        await dumpRecords(this.directory, records.records.unique_id, records,
            nickname_and_icons.nickname_and_icons[0]);

        if (this.profile_image) {
            await dumpProfileImage(this.splatnet, this.directory, records.records.unique_id, this.stages,
                nickname_and_icons.nickname_and_icons[0],
                this.favourite_stage, this.favourite_colour);
        }

        if (this.results) {
            await dumpResults(this.splatnet, this.directory, records.records.unique_id,
                this.result_images, this.results_summary_image);
        }
        if (this.coop_results) {
            await dumpCoopResults(this.splatnet, this.directory, records.records.unique_id);
        }
    }

    async handleError(err: Error | ErrorResponse<WebServiceError>): Promise<LoopResult> {
        if ('response' in err && err.data.code === 'AUTHENTICATION_ERROR') {
            // Token expired
            debug('Renewing iksm_session cookie');

            if (!this.auto_update_iksm_session) {
                throw new Error('iksm_session cookie expired');
            }

            await renewIksmToken(this.splatnet, this.storage, this.token, this.znc_proxy_url);

            return LoopResult.OK_SKIP_INTERVAL;
        } else {
            throw err;
        }
    }
}
