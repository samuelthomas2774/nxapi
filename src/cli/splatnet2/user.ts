import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getIksmToken } from './util.js';

const debug = createDebug('cli:splatnet2:user');

export const command = 'user';
export const desc = 'Get the authenticated Nintendo Account\'s player record';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const [records, stages, activefestivals, timeline] = await Promise.all([
        splatnet.getRecords(),
        splatnet.getStages(),
        splatnet.getActiveFestivals(),
        splatnet.getTimeline(),
    ]);
    const nickname_and_icons = await splatnet.getUserNicknameAndIcon([records.records.player.principal_id]);

    console.log('Player %s (Splatoon 2 ID %s, NSA ID %s) level %d',
        records.records.player.nickname,
        records.records.unique_id,
        records.records.player.principal_id,
        records.records.player.player_rank,
        records.records.player.player_type);

    console.log(data.iksm_session);
}
