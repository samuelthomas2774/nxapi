import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import { SplatNet3CliTokenData } from '../../api/splatnet3.js';

const debug = createDebug('cli:splatnet3:token');

export const command = 'token';
export const desc = 'Get the authenticated Nintendo Account\'s SplatNet 3 user data and access token';

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
    const token: string = argv.token || await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    if (argv.json || argv.jsonPrettyPrint) {
        const result: SplatNet3CliTokenData = {
            bullet_token: data.bullet_token.bulletToken,
            expires_at: data.expires_at,
            language: data.bullet_token.lang,
            version: data.version,
        };

        console.log(JSON.stringify(result, null, argv.jsonPrettyPrint ? 4 : 0));
        return;
    }

    console.log(data.bullet_token.bulletToken);
}
