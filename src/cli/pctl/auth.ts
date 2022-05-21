import * as util from 'util';
import * as crypto from 'crypto';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../pctl.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getPctlToken } from '../../common/auth/moon.js';
import { getNintendoAccountSessionToken } from '../../api/na.js';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';

const debug = createDebug('cli:pctl:auth');

export const command = 'auth';
export const desc = 'Generate a link to login to a Nintendo Account';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('auth', {
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
    const state = crypto.randomBytes(36).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest().toString('base64url');

    const params = {
        state,
        redirect_uri: 'npf54789befb391a838://auth',
        client_id: ZNMA_CLIENT_ID,
        scope: [
            'openid',
            'user',
            'user.mii',
            'moonUser:administration',
            'moonDevice:create',
            'moonOwnedDevice:administration',
            'moonParentalControlSetting',
            'moonParentalControlSetting:update',
            'moonParentalControlSettingState',
            'moonPairingState',
            'moonSmartDevice:administration',
            'moonDailySummary',
            'moonMonthlySummary',
        ].join(' '),
        response_type: 'session_token_code',
        session_token_code_challenge: challenge,
        session_token_code_challenge_method: 'S256',
    };

    const authoriseurl = 'https://accounts.nintendo.com/connect/1.0.0/authorize?' +
        new URLSearchParams(params).toString();

    debug('Authentication parameters', {
        state,
        verifier,
        challenge,
    }, params);

    console.log('1. Open this URL and login to your Nintendo Account:');
    console.log('');
    console.log(authoriseurl);
    console.log('');

    console.log('2. On the "Linking an External Account" page, right click "Select this person" and copy the link. It should start with "npf54789befb391a838://auth".');
    console.log('');

    const read = await import('read');
    // @ts-expect-error
    const prompt = util.promisify(read.default as typeof read);

    const applink = await prompt({
        prompt: `Paste the link: `,
        // silent: true,
        output: process.stderr,
    });

    console.log('');

    const authorisedurl = new URL(applink);
    const authorisedparams = new URLSearchParams(authorisedurl.hash.substr(1));
    debug('Redirect URL parameters', [...authorisedparams.entries()]);

    const code = authorisedparams.get('session_token_code')!;
    const token = await getNintendoAccountSessionToken(code, verifier, ZNMA_CLIENT_ID);

    console.log('Session token', token);

    if (argv.auth) {
        const storage = await initStorage(argv.dataPath);

        const {moon, data} = await getPctlToken(storage, token.session_token);

        console.log('Authenticated as Nintendo Account %s (%s)',
            data.user.nickname, data.user.id);

        await storage.setItem('NintendoAccountToken-pctl.' + data.user.id, token.session_token);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(data.user.id);
        await storage.setItem('NintendoAccountIds', [...users]);

        if ('select' in argv ? argv.select : users.size === 1) {
            await storage.setItem('SelectedUser', data.user.id);

            console.log('Set as default user');
        }
    }
}
