import { readFile, writeFile } from 'node:fs/promises';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import { languages as splatnet3_languages } from '../../api/splatnet3.js';

const debug = createDebug('cli:util:update-s3si-token');
debug.enabled = true;

export const command = 'update-s3si-token <profile>';
export const desc = 'Update a s3si.ts profile with valid tokens for SplatNet 3';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('profile', {
        describe: 's3si.ts profile path',
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
    }).option('language', {
        describe: 'SplatNet 3 language - by default this command will set the language to your Nintendo Account language, use this to force a different language, usually `en-US` when exporting to Splashcat',
        type: 'string',
        choices: splatnet3_languages,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!argv.profile) {
        console.warn('Path to s3si.ts profile not set.');
        process.exit(1);
    }

    const profile_json = await readFile(argv.profile, 'utf-8').catch(err => {
        if (err.code === 'ENOENT') return null;
        throw err;
    });

    if (!profile_json) {
        debug('s3si.ts profile does not exist, will create new profile');
    }

    const profile = profile_json ? JSON.parse(profile_json) as ProfileState : null;

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token || await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const updated_profile: ProfileState = {
        ...default_profile,
        ...profile,

        loginState: {
            sessionToken: 'null',
            gToken: data.webserviceToken.accessToken,
            bulletToken: data.bullet_token.bulletToken,
        },

        userLang: argv.language ?? data.language,
        userCountry: data.country,
    };

    debug('writing s3si.ts profile');
    await writeFile(argv.profile, JSON.stringify(updated_profile, null, 2) + '\n', 'utf-8');
}

interface ProfileState {
    loginState?: ProfileLoginState;
    fGen: string;
    appUserAgent?: string;
    userLang?: string;
    userCountry?: string;
    rankState?: ProfileRankState;
    cacheDir: string;

    statInkApiKey?: string;
    fileExportPath: string;
    monitorInterval: number;
    splashcatApiKey?: string;
}
interface ProfileLoginState {
    sessionToken?: string;
    gToken?: string;
    bulletToken?: string;
}
interface ProfileRankState {
    gameId: string;
    timestamp?: number;
    rank: string;
    rankPoint: number;
}

const default_profile: ProfileState = {
    cacheDir: './cache',
    fGen: 'https://api.imink.app/f',
    fileExportPath: './export',
    monitorInterval: 500,
};
