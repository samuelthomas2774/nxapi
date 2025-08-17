import { readFile, writeFile } from 'node:fs/promises';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:util:update-s3s-token');
debug.enabled = true;

export const command = 'update-s3s-token <config>';
export const desc = 'Update a s3s config file with valid tokens for SplatNet 3';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('config', {
        describe: 's3s config file path',
        type: 'string',
    }).option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    }).option('auto-update-session', {
        describe: 'Automatically obtain and refresh the SplatNet 3 access token',
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
        console.warn('Path to s3s config file not set.');
        process.exit(1);
    }

    const config_json = await readFile(argv.config, 'utf-8').catch(err => {
        if (err.code === 'ENOENT') return null;
        throw err;
    });

    if (!config_json) {
        debug('s3s config file does not exist, will create new config file');
    }

    const config = config_json ? JSON.parse(config_json) as S3sConfig : null;

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token || await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const updated_config: S3sConfig = {
        ...default_config,
        ...config,

        acc_loc: data.language + '|' + data.country,
        gtoken: data.webserviceToken.accessToken,
        bullettoken: data.bullet_token.bulletToken,
        session_token: 'skip',
    };

    debug('writing s3s config file');
    await writeFile(argv.config, JSON.stringify(updated_config, null, 4) + '\n', 'utf-8');
}

interface S3sConfig {
    api_key: string;
    acc_loc: string;
    gtoken: string;
    bullettoken: string;
    session_token: string;
    f_gen: string;
}

const default_config: S3sConfig = {
    api_key: '',
    acc_loc: '',
    gtoken: '',
    bullettoken: '',
    session_token: '',
    f_gen: '',
};
