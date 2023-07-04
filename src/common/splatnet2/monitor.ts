import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import persist from 'node-persist';
import mkdirp from 'mkdirp';
import SplatNet2Api, { SplatNet2ErrorResponse } from '../../api/splatnet2.js';
import { renewIksmToken } from '../auth/splatnet2.js';
import { Records, Stages } from '../../api/splatnet2-types.js';
import { dumpCoopResults, dumpResults } from './dump-results.js';
import { dumpProfileImage, dumpRecords } from './dump-records.js';
import createDebug from '../../util/debug.js';
import Loop, { LoopResult } from '../../util/loop.js';

const debug = createDebug('nxapi:splatnet2:monitor');

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

    async handleError(err: Error): Promise<LoopResult> {
        if (err instanceof SplatNet2ErrorResponse && err.data?.code === 'AUTHENTICATION_ERROR') {
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
