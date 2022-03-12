import * as util from 'util';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../util.js';

const debug = createDebug('cli:token');

export const command = 'token [token]';
export const desc = 'Set the default Nintendo Account session token';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('token', {
        describe: 'Nintendo Account session token (it is recommended this is not set and you enter it interactively)',
        type: 'string',
    }).option('auth', {
        describe: 'Authenticate immediately',
        type: 'boolean',
        default: true,
    }).option('select', {
        describe: 'Set as default user (default: true if only user)',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    if (!argv.token) {
        const read = await import('read');
        // @ts-expect-error
        const prompt = util.promisify(read.default as typeof read);

        argv.token = await prompt({
            prompt: `Token: `,
            silent: true,
            output: process.stderr,
        });
    }

    await storage.setItem('SessionToken', argv.token);

    if (argv.auth) {
        const {nso, data} = await getToken(storage, argv.token);

        console.log('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
            data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

        await storage.setItem('NintendoAccountToken.' + data.user.id, argv.token);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(data.user.id);
        await storage.setItem('NintendoAccountIds', [...users]);

        if ('select' in argv ? argv.select : users.size === 1) {
            await storage.setItem('SelectedUser', data.user.id);

            console.log('Set as default user');
        }
    } else {
        console.log('Saved token');
    }
}
