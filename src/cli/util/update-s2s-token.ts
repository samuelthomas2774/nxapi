import { readFile, writeFile } from 'node:fs/promises';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';

const debug = createDebug('cli:util:update-s2s-token');
debug.enabled = true;

export const command = 'update-s2s-token <config>';
export const desc = 'Update a splatnet2statink config file with valid tokens for SplatNet 2';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('config', {
        describe: 'splatnet2statink config file path',
        type: 'string',
    }).option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    }).option('auto-update-session', {
        describe: 'Automatically obtain and refresh the iksm_session cookie',
        type: 'boolean',
        default: true,
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!argv.config) {
        console.warn('Path to splatnet2statink config file not set.');
        process.exit(1);
    }

    const config_json = await readFile(argv.config, 'utf-8').catch(err => {
        if (err.code === 'ENOENT') return null;
        throw err;
    });

    if (!config_json) {
        debug('splatnet2statink config file does not exist, will create new config file');
    }

    const config = config_json ? JSON.parse(config_json) as Splatnet2statinkConfig : null;

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token || await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const updated_config: Splatnet2statinkConfig = {
        ...default_config,
        ...config,

        cookie: data.iksm_session,
        user_lang: data.language,
        session_token: 'skip',
        app_unique_id: data.user_id,
    };

    debug('writing splatnet2statink config file');
    await writeFile(argv.config, JSON.stringify(updated_config, null, 4) + '\n', 'utf-8');
}

interface Splatnet2statinkConfig {
    api_key: string;
    cookie: string;
    user_lang: string;
    session_token: string;

    app_timezone_offset?: string;
    app_unique_id?: string;
    app_user_agent?: string;
}

const default_config: Splatnet2statinkConfig = {
    api_key: '',
    cookie: '',
    user_lang: '',
    session_token: '',
};
