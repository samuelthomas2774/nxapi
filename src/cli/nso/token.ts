import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/coral.js';
import prompt from '../util/prompt.js';

const debug = createDebug('cli:nso:token');

export const command = 'token [token]';
export const desc = 'Set the default Nintendo Account session token';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('token', {
        describe: 'Nintendo Account session token (it is recommended this is not set and you enter it interactively)',
        type: 'string',
    }).option('select', {
        describe: 'Set as default user (default: true if only user)',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    if (!argv.token) {
        argv.token = await prompt({
            prompt: `Token: `,
            silent: true,
        });
    }

    const {nso, data} = await getToken(storage, argv.token, argv.zncProxyUrl);

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    await storage.setItem('NintendoAccountToken.' + data.user.id, argv.token);

    const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
    users.add(data.user.id);
    await storage.setItem('NintendoAccountIds', [...users]);

    console.log('Saved token');

    if ('select' in argv ? argv.select : users.size === 1) {
        await storage.setItem('SelectedUser', data.user.id);

        console.log('Set as default user');
    }
}
