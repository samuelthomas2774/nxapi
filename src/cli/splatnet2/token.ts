import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';
import { SplatNet2CliTokenData } from '../../api/splatnet2.js';

const debug = createDebug('cli:splatnet2:token');

export const command = 'token';
export const desc = 'Get the authenticated Nintendo Account\'s SplatNet 2 user data and iksm_session cookie';

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
    const {splatnet, data} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    if (argv.json || argv.jsonPrettyPrint) {
        const result: SplatNet2CliTokenData = {
            iksm_session: data.iksm_session,
            language: data.language,
            region: data.region,
            user_id: data.user_id,
            nsa_id: data.nsa_id,
        };

        console.log(JSON.stringify(result, null, argv.jsonPrettyPrint ? 4 : 0));
        return;
    }

    console.log(data.iksm_session);
}
