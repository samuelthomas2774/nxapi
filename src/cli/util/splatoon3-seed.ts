import createDebug from 'debug';
import murmurhash from 'murmurhash';
import { ResultTypes } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from './index.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api from '../../api/splatnet3.js';

const debug = createDebug('cli:util:splatoon3-seed');

export const command = 'splatoon3-seed [id]';
export const desc = 'Fetches data for https://leanny.github.io/splat3seedchecker/';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('id', {
        describe: 'Replay code',
        type: 'string',
    }).option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    }).option('auto-update-session', {
        describe: 'Automatically obtain and refresh the SplatNet 3 access token',
        type: 'boolean',
        default: true,
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('include-gear', {
        describe: 'Fetch all gear from SplatNet 3',
        type: 'boolean',
    }).option('json', {
        describe: 'Output raw JSON',
        type: 'boolean',
    }).option('json-pretty-print', {
        describe: 'Output pretty-printed JSON',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token || await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    splatnet.getCurrentFest();
    splatnet.getConfigureAnalytics();

    const npln_user_id = await getNplnUserId(splatnet, argv.id);
    debug('NPLN user ID', npln_user_id);

    const hash = murmurhash.v3(npln_user_id);
    debug('hash', hash);

    const key = Buffer.from(npln_user_id);
    for (let i = 0; i < key.length; i++) {
        key[i] ^= hash & 0xff;
    }

    const key_str = key.toString('base64');
    debug('key', key_str);

    if (argv.json || argv.jsonPrettyPrint) {
        let equipment;
        if (argv.includeGear ?? true) {
            debug('Fetching equipment');
            equipment = await splatnet.getEquipment();
        }

        console.log(JSON.stringify({
            key: key_str,
            h: hash,
            timestamp: Math.floor(Date.now() / 1000),
            gear: equipment,
        }, null, argv.jsonPrettyPrint ? 4 : 0));
        return;
    }

    console.log('Key   %s', key.toString('hex'));
    console.log('Hash  %d', hash);
}

const REPLAY_CODE_REGEX = /^[A-Z0-9]{16}$/;

function getNplnUserId(splatnet: SplatNet3Api, id?: string) {
    if (id) {
        if (id.replace(/-/g, '').match(REPLAY_CODE_REGEX)) {
            return getNplnUserIdFromReplayCode(splatnet, id.replace(/-/g, ''));
        }

        throw new Error('Invalid argument "' + id + '"');
    }

    return getNplnUserIdSelf(splatnet);
}

async function getNplnUserIdSelf(splatnet: SplatNet3Api) {
    debug('Fetching outfits');

    const outfits = await splatnet.getMyOutfits();

    if (outfits.data.myOutfits.edges.length) {
        const outfit = await splatnet.getMyOutfitDetail(outfits.data.myOutfits.edges[0].node.id);
    }

    const outfit_id = outfits.data.myOutfits.edges[0]?.node.id;

    if (outfit_id) {
        const id_str = Buffer.from(outfit_id, 'base64').toString();
        const match = id_str.match(/^MyOutfit-(u-[0-9a-z]{20}):(\d+)$/);
        if (match) return match[1];
    }

    debug('Failed to get NPLN user ID from outfits, fetching battle histories');

    const [player, battles, battles_regular, battles_anarchy, battles_private] = await Promise.all([
        splatnet.getBattleHistoryCurrentPlayer(),
        splatnet.getLatestBattleHistories(),
        splatnet.getRegularBattleHistories(),
        splatnet.getBankaraBattleHistories(),
        splatnet.getPrivateBattleHistories(),
    ]);

    const latest_id = battles.data.latestBattleHistories.historyGroupsOnlyFirst.nodes[0]?.historyDetails.nodes[0].id;
    
    if (latest_id) {
        const id_str = Buffer.from(latest_id, 'base64').toString();
        const match = id_str.match(/^VsHistoryDetail-(u-[0-9a-z]{20}):([A-Z]+):((\d{8,}T\d{6})_([0-9a-f-]{36}))$/);
        if (match) return match[1];
    }

    throw new Error('Failed to get NPLN user ID, try creating an outfit or play an online battle');
}

async function getNplnUserIdFromReplayCode(splatnet: SplatNet3Api, code: string) {
    debug('Fetching replay');

    const replays = await splatnet.getReplays();
    const replay = await splatnet.getReplaySearchResult(code);

    const id_str = Buffer.from(replay.data.replay.id, 'base64').toString();
    debug('replay', id_str);

    const match = id_str.match(/^Replay-(u-[0-9a-z]{20}):([0-9A-Z]{16})$/);
    if (!match) throw new Error('Unable to find NPLN user ID from replay ID');
    return match[1];
}
