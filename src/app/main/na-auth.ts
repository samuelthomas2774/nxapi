import * as crypto from 'crypto';
import createDebug from 'debug';
import * as persist from 'node-persist';
import { BrowserWindow, Notification, session, shell } from './electron.js';
import { getNintendoAccountSessionToken, NintendoAccountSessionToken } from '../../api/na.js';
import { ZNCA_CLIENT_ID } from '../../api/znc.js';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';
import { getToken, SavedToken } from '../../common/auth/nso.js';
import { getPctlToken, SavedMoonToken } from '../../common/auth/moon.js';
import { Jwt } from '../../util/jwt.js';
import { tryGetNativeImageFromUrl } from './util.js';

const debug = createDebug('app:main:na-auth');

export type NintendoAccountAuthResult = NintendoAccountSessionToken;

export function getAuthUrl(client_id: string, scope: string | string[]) {
    const state = crypto.randomBytes(36).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest().toString('base64url');

    const params = {
        state,
        redirect_uri: 'npf' + client_id + '://auth',
        client_id,
        scope: typeof scope === 'string' ? scope : scope.join(' '),
        response_type: 'session_token_code',
        session_token_code_challenge: challenge,
        session_token_code_challenge_method: 'S256',
        theme: 'login_form',
    };

    const url = 'https://accounts.nintendo.com/connect/1.0.0/authorize?' +
        new URLSearchParams(params).toString();

    return {
        url,
        state,
        verifier,
        challenge,
    };
}

let i = 0;

export function createAuthWindow() {
    const browser_session = session.defaultSession;

    const window = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: 'Nintendo Account',
        webPreferences: {
            session: browser_session,
            scrollBounce: true,
        },
    });

    return window;
}

export interface NintendoAccountSessionTokenCode {
    code: string;
    verifier: string;
    window?: BrowserWindow;
}

export function getSessionTokenCode(client_id: string, scope: string | string[], close_window = true) {
    return new Promise<NintendoAccountSessionTokenCode>((rs, rj) => {
        const {url: authoriseurl, state, verifier, challenge} = getAuthUrl(client_id, scope);
        const window = createAuthWindow();

        window.webContents.on('will-navigate', (event, url_string) => {
            const url = new URL(url_string);

            debug('will navigate', url);

            if (url.protocol === 'npf' + client_id + ':' && url.host === 'auth') {
                const authorisedparams = new URLSearchParams(url.hash.substr(1));
                debug('Redirect URL parameters', [...authorisedparams.entries()]);

                const code = authorisedparams.get('session_token_code')!;
                const [jwt, sig] = Jwt.decode(code);

                debug('code', code, jwt, sig);

                if (close_window) {
                    rs({
                        code,
                        verifier,
                    });

                    window.close();
                } else {
                    rs({
                        code,
                        verifier,
                        window,
                    });
                }
            } else if (url.origin === 'https://accounts.nintendo.com') {
                // Ok
            } else {
                event.preventDefault();
            }
        });

        window.on('closed', () => {
            rj(new Error('Canceled'));
        });

        window.webContents.on('did-fail-load', e => rj(e));

        window.webContents.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';

        window.webContents.setWindowOpenHandler(details => {
            debug('open', details);
            shell.openExternal(details.url);
            return {action: 'deny'};
        });

        debug('Loading Nintendo Account authorisation', {
            authoriseurl,
            state,
            verifier,
            challenge,
        });

        window.loadURL(authoriseurl);
    });
}

const NSO_SCOPE = [
    'openid',
    'user',
    'user.birthday',
    'user.mii',
    'user.screenName',
];

export async function addNsoAccount(storage: persist.LocalStorage) {
    const {code, verifier, window} = await getSessionTokenCode(ZNCA_CLIENT_ID, NSO_SCOPE, false);

    window?.setFocusable(false);
    window?.blurWebView();

    try {
        const [jwt, sig] = Jwt.decode(code);

        const nsotoken = await storage.getItem('NintendoAccountToken.' + jwt.payload.sub) as string | undefined;

        if (nsotoken) {
            const data = await storage.getItem('NsoToken.' + nsotoken) as SavedToken | undefined;

            debug('Already authenticated', data);

            new Notification({
                title: 'Nintendo Switch Online',
                body: 'Already signed in as ' + data?.nsoAccount.user.name + ' (' + data?.user.nickname + ')',
                icon: await tryGetNativeImageFromUrl(data!.nsoAccount.user.imageUri),
            }).show();

            return getToken(storage, nsotoken, process.env.ZNC_PROXY_URL);
        }

        const token = await getNintendoAccountSessionToken(code, verifier, ZNCA_CLIENT_ID);

        debug('session token', token);

        const {nso, data} = await getToken(storage, token.session_token, process.env.ZNC_PROXY_URL);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(data.user.id);
        await storage.setItem('NintendoAccountIds', [...users]);

        new Notification({
            title: 'Nintendo Switch Online',
            body: 'Authenticated as ' + data.nsoAccount.user.name + ' (NSO ' + data.user.nickname + ')',
            icon: await tryGetNativeImageFromUrl(data.nsoAccount.user.imageUri),
        }).show();

        return {nso, data};
    } finally {
        window?.close();
    }
}

const MOON_SCOPE = [
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
];

export async function addPctlAccount(storage: persist.LocalStorage) {
    const {code, verifier, window} = await getSessionTokenCode(ZNMA_CLIENT_ID, MOON_SCOPE, false);

    window?.setFocusable(false);
    window?.blurWebView();

    try {
        const [jwt, sig] = Jwt.decode(code);

        const moontoken = await storage.getItem('NintendoAccountToken-pctl.' + jwt.payload.sub) as string | undefined;

        if (moontoken) {
            const data = await storage.getItem('MoonToken.' + moontoken) as SavedMoonToken | undefined;

            debug('Already authenticated', data);

            new Notification({
                title: 'Nintendo Switch Parental Controls',
                body: 'Already signed in as ' + data?.user.nickname,
            }).show();

            return getPctlToken(storage, moontoken);
        }

        const token = await getNintendoAccountSessionToken(code, verifier, ZNMA_CLIENT_ID);

        debug('session token', token);

        const {moon, data} = await getPctlToken(storage, token.session_token);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(data.user.id);
        await storage.setItem('NintendoAccountIds', [...users]);

        new Notification({
            title: 'Nintendo Switch Parental Controls',
            body: 'Authenticated as ' + data.user.nickname,
        }).show();

        return {moon, data};
    } finally {
        window?.close();
    }
}
