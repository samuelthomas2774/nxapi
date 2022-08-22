import process from 'node:process';
import * as crypto from 'node:crypto';
import createDebug from 'debug';
import * as persist from 'node-persist';
import { BrowserWindow, dialog, MessageBoxOptions, Notification, session, shell } from './electron.js';
import { getNintendoAccountSessionToken, NintendoAccountSessionToken } from '../../api/na.js';
import { ZNCA_CLIENT_ID } from '../../api/coral.js';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';
import { getToken, SavedToken } from '../../common/auth/coral.js';
import { getPctlToken, SavedMoonToken } from '../../common/auth/moon.js';
import { Jwt } from '../../util/jwt.js';
import { tryGetNativeImageFromUrl } from './util.js';
import { ZNCA_API_USE_URL } from '../../common/constants.js';

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

const css = `
html {
    overflow-x: hidden;
}
`;

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

    window.webContents.on('did-finish-load', () => {
        window.webContents.insertCSS(css);
    });

    return window;
}

export interface NintendoAccountSessionTokenCode {
    code: string;
    verifier: string;
    window?: BrowserWindow;
}

export class AuthoriseError extends Error {
    constructor(readonly code: string, message?: string) {
        super(message);
    }

    static fromSearchParams(qs: URLSearchParams) {
        const code = qs.get('error') ?? 'unknown_error';
        return new AuthoriseError(code, qs.get('error_description') ?? code);
    }
}

export class AuthoriseCancelError extends AuthoriseError {
    constructor(message?: string) {
        super('access_denied', message);
    }
}

export function getSessionTokenCode(client_id: string, scope: string | string[], close_window: false):
    Promise<NintendoAccountSessionTokenCode & {window: BrowserWindow}>
export function getSessionTokenCode(client_id: string, scope: string | string[], close_window: true):
    Promise<NintendoAccountSessionTokenCode & {window?: never}>
export function getSessionTokenCode(client_id: string, scope: string | string[], close_window?: boolean):
    Promise<NintendoAccountSessionTokenCode & {window?: BrowserWindow}>
export function getSessionTokenCode(client_id: string, scope: string | string[], close_window = true) {
    return new Promise<NintendoAccountSessionTokenCode>((rs, rj) => {
        const {url: authoriseurl, state, verifier, challenge} = getAuthUrl(client_id, scope);
        const window = createAuthWindow();

        const handleAuthUrl = (url: URL) => {
            const authorisedparams = new URLSearchParams(url.hash.substr(1));
            debug('Redirect URL parameters', [...authorisedparams.entries()]);

            if (authorisedparams.get('state') !== state) {
                rj(new Error('Invalid state'));
                window.close();
                return;
            }

            if (authorisedparams.has('error')) {
                rj(AuthoriseError.fromSearchParams(authorisedparams));
                window.close();
                return;
            }

            if (!authorisedparams.has('session_token_code')) {
                rj(new Error('Response didn\'t include a session token code'));
                window.close();
                return;
            }

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
        };

        window.webContents.on('will-navigate', (event, url_string) => {
            const url = new URL(url_string);

            debug('will navigate', url);

            if (url.protocol === 'npf' + client_id + ':' && url.host === 'auth') {
                handleAuthUrl(url);
                event.preventDefault();
            } else if (url.origin === 'https://accounts.nintendo.com') {
                // Ok
            } else {
                event.preventDefault();
            }
        });

        window.on('closed', () => {
            rj(new AuthoriseCancelError('Canceled'));
        });

        window.webContents.on('did-fail-load', e => rj(e));

        window.webContents.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';

        window.webContents.setWindowOpenHandler(details => {
            const url = new URL(details.url);

            debug('open', details);

            if (url.protocol === 'npf' + client_id + ':' && url.host === 'auth') {
                handleAuthUrl(url);
            } else {
                shell.openExternal(details.url);
            }

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

    window.setFocusable(false);
    window.blurWebView();

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

            return getToken(storage, nsotoken, process.env.ZNC_PROXY_URL, false);
        }

        await checkZncaApiUseAllowed(storage, window);

        const token = await getNintendoAccountSessionToken(code, verifier, ZNCA_CLIENT_ID);

        debug('session token', token);

        const {nso, data} = await getToken(storage, token.session_token, process.env.ZNC_PROXY_URL, false);

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
        window.close();
    }
}

export async function askAddNsoAccount(storage: persist.LocalStorage) {
    try {
        return await addNsoAccount(storage);
    } catch (err: any) {
        if (err instanceof AuthoriseError && err.code === 'access_denied') return;

        dialog.showErrorBox('Error adding account', err.stack || err.message);
    }
}

async function checkZncaApiUseAllowed(storage: persist.LocalStorage, window?: BrowserWindow, force = false) {
    if (!force) {
        if (await storage.getItem('ZncaApiConsent')) {
            return;
        }

        if (process.env.ZNC_PROXY_URL) {
            debug('Skipping znca API consent; znc proxy URL set');
            await storage.setItem('ZncaApiConsent', true);
            return;
        }

        const ids: string[] | undefined = await storage.getItem('NintendoAccountIds');

        for (const id of ids ?? []) {
            const nsotoken: string | undefined = await storage.getItem('NintendoAccountToken.' + id);
            if (!nsotoken) continue;

            debug('Skipping znca API consent; Nintendo Switch Online account already linked');
            await storage.setItem('ZncaApiConsent', true);
            return;
        }
    }

    if (await askZncaApiUseAllowed(window)) {
        await storage.setItem('ZncaApiConsent', true);
    } else {
        throw new Error('Cannot continue without third-party APIs allowed');
    }
}

const ZNCA_API_USE_TEXT = `To access the Nintendo Switch Online app API, nxapi must send some data to third-party APIs. This is required to generate some data to make Nintendo think you\'re using the real Nintendo Switch Online app.

By default, this uses the imink API, but another service can be used by setting an environment variable. The default API may change without notice if you do not force use of a specific service.

The data sent includes:
- A random UUID and the current timestamp
- (When authenticating to the Nintendo Switch Online app) An ID token, containing your Nintendo Account ID and country, which is valid for 15 minutes
- (When authenticating to game-specific services) An ID token, containing your Coral (Nintendo Switch Online app) user ID, Nintendo Switch Online membership status, and Nintendo Account child restriction status, which is valid for 2 hours`;

async function askZncaApiUseAllowed(window?: BrowserWindow): Promise<boolean> {
    const options: MessageBoxOptions = {
        message: 'Third-party API usage',
        detail: ZNCA_API_USE_TEXT,
        buttons: ['OK', 'Cancel', 'More information'],
        cancelId: 1,
    };

    const result = window ?
        await dialog.showMessageBox(window, options) :
        await dialog.showMessageBox(options);

    debug('znca API consent', result);

    if (result.response === 2) {
        shell.openExternal(ZNCA_API_USE_URL);
        return askZncaApiUseAllowed(window);
    }

    return result.response === 0;
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

            return getPctlToken(storage, moontoken, false);
        }

        const token = await getNintendoAccountSessionToken(code, verifier, ZNMA_CLIENT_ID);

        debug('session token', token);

        const {moon, data} = await getPctlToken(storage, token.session_token, false);

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

export async function askAddPctlAccount(storage: persist.LocalStorage) {
    try {
        return await addPctlAccount(storage);
    } catch (err: any) {
        if (err instanceof AuthoriseError && err.code === 'access_denied') return;

        dialog.showErrorBox('Error adding account', err.stack || err.message);
    }
}
