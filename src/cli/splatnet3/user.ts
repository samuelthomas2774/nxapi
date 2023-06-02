import type { Arguments as ParentArguments } from '../splatnet3.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:splatnet3:user');

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
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const history = await splatnet.getHistoryRecords();

    console.log('Player %s#%s (title %s, first played %s)',
        history.data.currentPlayer.name,
        history.data.currentPlayer.nameId,
        history.data.currentPlayer.byname,
        new Date(history.data.playHistory.gameStartTime).toLocaleString());
}
