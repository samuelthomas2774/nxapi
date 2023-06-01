import type { Arguments as ParentArguments } from '../nooklink.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getUserToken } from '../../common/auth/nooklink.js';
import { NooklinkUserCliTokenData } from '../../api/nooklink.js';

const debug = createDebug('cli:nooklink:user-token');

export const command = 'user-token';
export const desc = 'Get the player\'s NookLink user authentication token';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
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
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl, argv.autoUpdateSession);

    if (argv.json || argv.jsonPrettyPrint) {
        const result: NooklinkUserCliTokenData = {
            gtoken: nooklinkuser.gtoken,
            version: nooklinkuser.client_version,

            auth_token: data.token.token,
            expires_at: data.token.expireAt,
            user_id: data.user_id,
            language: nooklinkuser.language,
        };

        console.log(JSON.stringify(result, null, argv.jsonPrettyPrint ? 4 : 0));
        return;
    }

    console.log(data.token.token);
}
