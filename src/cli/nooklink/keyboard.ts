import { promisify } from 'util';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getUserToken } from './util.js';

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
        const read = await import('read');
        // @ts-expect-error
        const prompt = promisify(read.default as typeof read);

        argv.message = await prompt({
            prompt: `Message: `,
            output: process.stderr,
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
