import { read } from 'read';
import type { Arguments as ParentArguments } from '../nooklink.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getUserToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:keyboard');

export const command = 'keyboard [message]';
export const desc = 'Send a message in an online Animal Crossing: New Horizons session';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('message', {
        describe: 'Message text',
        type: 'string',
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!argv.message) {
        argv.message = await read<string>({
            output: process.stderr,
            prompt: 'Message: ',
        });
    }

    if (!argv.message) return;
    if (argv.message?.length > 32) {
        throw new Error('Message must be less than or equal to 32 characters');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl, argv.autoUpdateSession);

    await nooklinkuser.keyboard(argv.message);
}
