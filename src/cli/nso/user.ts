import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getToken } from './util.js';

const debug = createDebug('cli:nso:user');

export const command = 'user';
export const desc = 'Get the authenticated Nintendo Account';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('force-refresh', {
        describe: 'Always fetch Nintendo Switch user data (not including Nintendo Account user data)',
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
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    if (argv.forceRefresh && 'expires_at' in data) {
        const user = await nso.getCurrentUser();

        console.log('Nintendo Account', data.user);
        console.log('Nintendo Switch user', user.result);
    } else {
        console.log('Nintendo Account', data.user);
        console.log('Nintendo Switch user', data.nsoAccount.user);
    }
}
