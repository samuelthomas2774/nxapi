import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import mkdirp from 'mkdirp';
import { FestState, Fest_detail, RequestId } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api, { RequestIdSymbol } from '../../api/splatnet3.js';
import { ResponseSymbol } from '../../api/util.js';

const debug = createDebug('cli:splatnet3:dump-records');

export const command = 'dump-fests [directory]';
export const desc = 'Download all Splatfest records';

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
    }).option('include-rankings', {
        describe: 'Include fest rankings',
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
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await mkdirp(directory);

    await dumpFestRecords(splatnet, directory, argv.includeRankings);
}

export async function dumpFestRecords(splatnet: SplatNet3Api, directory: string, include_rankings = false) {
    debug('Fetching fest records');
    console.warn('Fetching fest records');

    const records = await splatnet.getFestRecords();

    const filename = 'splatnet3-fests-' + Date.now() + '.json';
    const file = path.join(directory, filename);

    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify({
        result: records.data.festRecords,
        player: records.data.currentPlayer,
        query: records[RequestIdSymbol],
        app_version: splatnet.version,
        be_version: records[ResponseSymbol].headers.get('x-be-version'),
    }, null, 4) + '\n', 'utf-8');

    const skipped = [];

    for (const fest_record of [...records.data.festRecords.nodes].reverse()) {
        // Fest-EU:JUEA-00001
        const id_str = Buffer.from(fest_record.id, 'base64').toString() || fest_record.id;
        const match = id_str.match(/^Fest-([A-Z]{2}):(([A-Z]+)-(\d+))$/);
        const id = match ? match[1] + '-' + match[2] : id_str;

        const filename = 'splatnet3-fest-' + id + '-' +
            (fest_record.state !== FestState.CLOSED ? Date.now() + '-' : '') +
            records[RequestIdSymbol] + '.json';
        const file = path.join(directory, filename);

        let record: Fest_detail | null = null;

        try {
            await fs.stat(file);
            // skipped.push(id);
        } catch (err) {
            debug('Fetching fest record %s', id);
            console.warn('Fetching fest record %s', id);

            const result = await splatnet.getFestDetail(fest_record.id);
            record = result.data.fest;

            debug('Writing %s', filename);
            await fs.writeFile(file, JSON.stringify({
                result: result.data.fest,
                player: result.data.currentPlayer,
                query: result[RequestIdSymbol],
                app_version: splatnet.version,
                be_version: result[ResponseSymbol].headers.get('x-be-version'),
            }, null, 4) + '\n', 'utf-8');
        }

        if (fest_record.state !== FestState.CLOSED) {
            const filename = 'splatnet3-festvotes-' + id + '-' + Date.now() + '-' +
                splatnet.getPersistedQueryId(RequestId.DetailVotingStatusQuery) + '.json';
            const file = path.join(directory, filename);

            // Fetch this now to match the behavour of Nintendo's app
            // If state !== closed it shouldn't be possible to get here
            if (!record) {
                const result = await splatnet.getFestDetail(fest_record.id);
                record = result.data.fest;
            }

            debug('Fetching fest voting status %s', id);
            console.warn('Fetching fest voting status %s', id);
            const result = await splatnet.getFestVotingStatus(fest_record.id);

            debug('Writing %s', filename);
            await fs.writeFile(file, JSON.stringify({
                result: result.data.fest,
                query: result[RequestIdSymbol],
                app_version: splatnet.version,
                be_version: result[ResponseSymbol].headers.get('x-be-version'),
            }, null, 4) + '\n', 'utf-8');
        }

        if (include_rankings) {
            const filename = 'splatnet3-festranking-' + id + '-' +
                splatnet.getPersistedQueryId(RequestId.DetailRankingQuery) + '.json';
            const file = path.join(directory, filename);

            try {
                await fs.stat(file);
            } catch (err) {
                // Fetch this now to match the behavour of Nintendo's app
                if (!record) {
                    const result = await splatnet.getFestDetail(fest_record.id);
                    record = result.data.fest!;
                }

                const rankings_available = record.state === FestState.CLOSED &&
                    !!record.teams[0].result;

                if (rankings_available) {
                    debug('Fetching fest rankings %s', id);
                    console.warn('Fetching fest rankings %s', id);
                    const result = await splatnet.getFestRanking(fest_record.id);

                    debug('Writing %s', filename);
                    await fs.writeFile(file, JSON.stringify({
                        result: result.data.fest,
                        query: result[RequestIdSymbol],
                        app_version: splatnet.version,
                        be_version: result[ResponseSymbol].headers.get('x-be-version'),
                    }, null, 4) + '\n', 'utf-8');
                } else {
                    debug('Skipping downloading rankings for %s, not yet available', id);
                }
            }
        }

        if (!record) {
            skipped.push(id);
        }
    }

    if (skipped.length) {
        if (skipped.length === 1) debug('Skipped fest %s, file already exists', skipped[0]);
        else debug('Skipped %d fests, files already exist', skipped.length);
    }
}
