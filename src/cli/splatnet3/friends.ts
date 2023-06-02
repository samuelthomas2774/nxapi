import { FriendOnlineState, Friend_friendList } from 'splatnet3-types/splatnet3';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:splatnet3:friends');

export const command = 'friends';
export const desc = 'List Nintendo Switch Online friends who have played Splatoon 3';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
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
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const friends = await splatnet.getFriends();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify({friends: friends.data.friends.nodes}, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify({friends: friends.data.friends.nodes}));
        return;
    }

    const table = new Table({
        head: [
            'NSA ID',
            'Name',
            'Status',
            'Locked?',
            'Voice chat?',
        ],
    });

    for (const friend of friends.data.friends.nodes) {
        const match = Buffer.from(friend.id, 'base64').toString().match(/^Friend-([0-9a-f]{16})$/);
        if (!match) table.options.head[0] = 'ID';
        const id_str = match ? match[1] : friend.id;

        table.push([
            id_str,
            friend.playerName === friend.nickname ? friend.playerName :
                friend.playerName ? friend.playerName + ' (' + friend.nickname + ')' :
                friend.nickname,
            getStateDescription(friend.onlineState,
                getVsModeDescription(friend.vsMode) ?? friend.vsMode?.name,
                getCoopModeDescription(friend.coopRule) ?? undefined),
            typeof friend.isLocked === 'boolean' ? friend.isLocked ? 'Yes' : 'No' : '-',
            typeof friend.isVcEnabled === 'boolean' ? friend.isVcEnabled ? 'Yes' : 'No' : '-',
        ]);
    }

    console.log(table.toString());
}

function getStateDescription(state: FriendOnlineState, vs_mode_desc?: string, coop_mode_desc?: string) {
    switch (state) {
        case FriendOnlineState.OFFLINE:
            return 'Offline';
        case FriendOnlineState.ONLINE:
            return 'Online';
        case FriendOnlineState.VS_MODE_MATCHING:
            return 'In lobby (' + (vs_mode_desc ?? 'VS') + ')';
        case FriendOnlineState.COOP_MODE_MATCHING:
            return 'In lobby (' + (coop_mode_desc ?? 'Salmon Run') + ')';
        case FriendOnlineState.VS_MODE_FIGHTING:
            return 'In game (' + (vs_mode_desc ?? 'VS') + ')';
        case FriendOnlineState.COOP_MODE_FIGHTING:
            return 'In game (' + (coop_mode_desc ?? 'Salmon Run') + ')';
        default: return state;
    }
}

function getVsModeDescription(vs_mode: Friend_friendList['vsMode'] | null) {
    if (!vs_mode) return null;

    if (vs_mode.mode === 'REGULAR') return 'Regular Battle';
    if (vs_mode.id === 'VnNNb2RlLTI=') return 'Anarchy Battle (Series)'; // VsMode-2
    if (vs_mode.id === 'VnNNb2RlLTUx') return 'Anarchy Battle (Open)'; // VsMode-51
    if (vs_mode.mode === 'BANKARA') return 'Anarchy Battle';
    if (vs_mode.id === 'VnNNb2RlLTY=') return 'Splatfest Battle (Open)'; // VsMode-6
    if (vs_mode.id === 'VnNNb2RlLTc=') return 'Splatfest Battle (Pro)'; // VsMode-7
    if (vs_mode.id === 'VnNNb2RlLTg=') return 'Tricolour Battle'; // VsMode-8
    if (vs_mode.mode === 'FEST') return 'Splatfest Battle';
    if (vs_mode.mode === 'LEAGUE') return 'League Battle';
    if (vs_mode.mode === 'X_MATCH') return 'X Battle';

    return null;
}

function getCoopModeDescription(coop_mode: string | null) {
    if (!coop_mode) return null;

    if (coop_mode === 'REGULAR') return 'Salmon Run';
    if (coop_mode === 'BIG_RUN') return 'Big Run';

    return null;
}
