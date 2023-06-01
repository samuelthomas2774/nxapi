import { app, BrowserWindow, dialog, MessageBoxOptions, Notification, session, shell } from './electron.js';
import process from 'node:process';
import * as crypto from 'node:crypto';
import * as persist from 'node-persist';
import { App, protocol_registration_options } from './index.js';
import { createModalWindow, createWindow } from './windows.js';
import { tryGetNativeImageFromUrl } from './util.js';
import { WindowType } from '../common/types.js';
import { getNintendoAccountSessionToken, NintendoAccountAuthError, NintendoAccountSessionToken } from '../../api/na.js';
import { ZNCA_CLIENT_ID } from '../../api/coral.js';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';
import { ErrorResponse } from '../../api/util.js';
import { getToken } from '../../common/auth/coral.js';
import { getPctlToken } from '../../common/auth/moon.js';
import createDebug from '../../util/debug.js';
import { Jwt } from '../../util/jwt.js';
import { ZNCA_API_USE_TEXT, ZNCA_API_USE_URL } from '../../common/constants.js';

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

export function createAuthWindow(app: App) {
    const browser_session = session.defaultSession;

    const window = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: app.i18n.t('na_auth:window.title') ?? 'Nintendo Account',
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

export function getSessionTokenCodeByInAppBrowser(
    app: App, client_id: string, scope: string | string[], close_window: false,
): Promise<NintendoAccountSessionTokenCode & {window: BrowserWindow}>
export function getSessionTokenCodeByInAppBrowser(
    app: App, client_id: string, scope: string | string[], close_window: true,
): Promise<NintendoAccountSessionTokenCode & {window?: never}>
export function getSessionTokenCodeByInAppBrowser(
    app: App, client_id: string, scope: string | string[], close_window?: boolean,
): Promise<NintendoAccountSessionTokenCode & {window?: BrowserWindow}>

export function getSessionTokenCodeByInAppBrowser(
    app: App, client_id: string, scope: string | string[], close_window = true,
) {
    return new Promise<NintendoAccountSessionTokenCode>((rs, rj) => {
        const {url: authoriseurl, state, verifier, challenge} = getAuthUrl(client_id, scope);
        const window = createAuthWindow(app);

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

const FORCE_MANUAL_AUTH_URI_ENTRY = process.env.NXAPI_FORCE_MANUAL_AUTH === '1';

export function getSessionTokenCodeByDefaultBrowser(
    client_id: string, scope: string | string[],
    close_window = true,
    force_manual = FORCE_MANUAL_AUTH_URI_ENTRY
) {
    return new Promise<NintendoAccountSessionTokenCode>((rs, rj) => {
        const {url: authoriseurl, state, verifier, challenge} = getAuthUrl(client_id, scope);
        let window: BrowserWindow | undefined = undefined;

        const handleAuthUrl = (url: URL) => {
            const authorisedparams = new URLSearchParams(url.hash.substr(1));
            debug('Redirect URL parameters', [...authorisedparams.entries()]);

            if (authorisedparams.get('state') !== state) {
                rj(new Error('Invalid state'));
                window?.close();
                return;
            }

            if (authorisedparams.has('error')) {
                rj(AuthoriseError.fromSearchParams(authorisedparams));
                window?.close();
                return;
            }

            if (!authorisedparams.has('session_token_code')) {
                rj(new Error('Response didn\'t include a session token code'));
                window?.close();
                return;
            }

            const code = authorisedparams.get('session_token_code')!;
            const [jwt, sig] = Jwt.decode(code);

            debug('code', code, jwt, sig);

            if (window && close_window) window.close();
            else if (window) rs({code, verifier, window});
            else rs({code, verifier});
        };

        debug('Prompting user for Nintendo Account authorisation', {
            authoriseurl,
            state,
            verifier,
            challenge,
        });

        const protocol = 'npf' + client_id;

        if (force_manual) {
            debug('Manual entry forced, prompting for redirect URI');
            window = askUserForRedirectUri(authoriseurl, client_id, handleAuthUrl, rj);
        } else if (app.isDefaultProtocolClient(protocol,
            protocol_registration_options?.path, protocol_registration_options?.argv
        )) {
            debug('App is already default protocol handler, opening browser');
            auth_state.set(state, [handleAuthUrl, rj, protocol]);
            shell.openExternal(authoriseurl);
        } else {
            const registered_app = app.getApplicationNameForProtocol(protocol);

            if (registered_app || !app.setAsDefaultProtocolClient(protocol,
                protocol_registration_options?.path, protocol_registration_options?.argv
            )) {
                debug('Another app is using the auth protocol or registration failed, prompting for redirect URI');
                window = askUserForRedirectUri(authoriseurl, client_id, handleAuthUrl, rj);
            } else {
                debug('App is now default protocol handler, opening browser');
                auth_state.set(state, [handleAuthUrl, rj, protocol]);
                shell.openExternal(authoriseurl);
            }
        }
    });
}

const auth_state = new Map<string, [rs: (url: URL) => void, rj: (reason: any) => void, protocol: string]>();

export function handleAuthUri(url_string: string) {
    const url = new URL(url_string);
    const qs = new URLSearchParams(url.hash.substr(1));

    debug('Received auth URL', url, qs.entries());

    const state_str = qs.get('state');
    if (!state_str) return;
    const state = auth_state.get(state_str);
    if (!state) return;

    debug('Received valid auth URL with state', state_str);

    auth_state.delete(state_str);
    const [rs, rj, protocol] = state;

    rs(url);
}

app.on('quit', () => {
    for (const [,, protocol] of auth_state.values()) {
        app.removeAsDefaultProtocolClient(protocol,
            protocol_registration_options?.path, protocol_registration_options?.argv);
    }
});

function askUserForRedirectUri(
    authoriseurl: string, client_id: string,
    handleAuthUrl: (url: URL) => void, rj: (reason: any) => void
) {
    const window = createModalWindow(WindowType.ADD_ACCOUNT_MANUAL_PROMPT, {
        authoriseurl,
        client_id,
    });

    window.webContents.on('will-navigate', (event, url_string) => {
        event.preventDefault();

        const url = new URL(url_string);

        debug('will navigate', url);

        if (url.protocol === 'npf' + client_id + ':' && url.host === 'auth') {
            handleAuthUrl(url);
        }
    });

    window.on('closed', () => {
        rj(new AuthoriseCancelError('Canceled'));
    });

    return window;
}

const NSO_SCOPE = [
    'openid',
    'user',
    'user.birthday',
    'user.mii',
    'user.screenName',
];

export async function addNsoAccount(app: App, use_in_app_browser = true) {
    const {code, verifier, window} = use_in_app_browser ?
        await getSessionTokenCodeByInAppBrowser(app, ZNCA_CLIENT_ID, NSO_SCOPE, false) :
        await getSessionTokenCodeByDefaultBrowser(ZNCA_CLIENT_ID, NSO_SCOPE, false);

    window?.setFocusable(false);
    window?.blurWebView();

    try {
        const [jwt, sig] = Jwt.decode(code);

        const nsotoken = await app.store.storage.getItem('NintendoAccountToken.' + jwt.payload.sub) as string | undefined;

        if (nsotoken) {
            debug('Already authenticated', jwt.payload);

            try {
                const {nso, data} = await getToken(app.store.storage, nsotoken, process.env.ZNC_PROXY_URL, false);

                new Notification({
                    title: app.i18n.t('na_auth:notification_coral.title') ?? 'Nintendo Switch Online',
                    body: app.i18n.t('na_auth:notification_coral.body_existing', {
                        name: data.nsoAccount.user.name,
                        na_name: data.user.nickname,
                        na_username: data.user.screenName,
                    }) ?? 'Already signed in as ' + data.nsoAccount.user.name + ' (Nintendo Account ' +
                        data.user.nickname + ' / ' + data.user.screenName + ')',
                    icon: await tryGetNativeImageFromUrl(data.nsoAccount.user.imageUri),
                }).show();

                return {nso, data};
            } catch (err) {
                if (err instanceof ErrorResponse && err.response.url.startsWith('https://accounts.nintendo.com/')) {
                    const data: NintendoAccountAuthError = err.data;

                    if (data.error === 'invalid_grant') {
                        // The session token has expired/was revoked
                        return authenticateCoralSessionToken(app, code, verifier, true);
                    }
                }

                throw err;
            }
        }

        await checkZncaApiUseAllowed(app, window);

        return authenticateCoralSessionToken(app, code, verifier);
    } finally {
        window?.close();
    }
}

async function authenticateCoralSessionToken(
    app: App,
    code: string, verifier: string,
    reauthenticate = false,
) {
    const token = await getNintendoAccountSessionToken(code, verifier, ZNCA_CLIENT_ID);

    debug('session token', token);

    const {nso, data} = await getToken(app.store.storage, token.session_token, process.env.ZNC_PROXY_URL, false);

    const users = new Set(await app.store.storage.getItem('NintendoAccountIds') ?? []);
    users.add(data.user.id);
    await app.store.storage.setItem('NintendoAccountIds', [...users]);

    new Notification({
        title: app.i18n.t('na_auth:notification_coral.title') ?? 'Nintendo Switch Online',
        body: app.i18n.t('na_auth:notification_coral.body_' + (reauthenticate ? 're' : '') + 'authenticated', {
            name: data.nsoAccount.user.name,
            na_name: data.user.nickname,
            na_username: data.user.screenName,
        }) ?? (reauthenticate ?
            'Reauthenticated to ' + data.nsoAccount.user.name + ' (Nintendo Account ' + data.user.nickname + ' / ' +
                data.user.screenName + ')' :
            'Authenticated as ' + data.nsoAccount.user.name + ' (Nintendo Account ' + data.user.nickname + ' / ' +
                data.user.screenName + ')'),
        icon: await tryGetNativeImageFromUrl(data.nsoAccount.user.imageUri),
    }).show();

    return {nso, data};
}

export async function askAddNsoAccount(app: App, iab = true) {
    try {
        return await addNsoAccount(app, iab);
    } catch (err: any) {
        if (err instanceof AuthoriseError && err.code === 'access_denied') return;

        dialog.showErrorBox(app.i18n.t('na_auth:error.title') ?? 'Error adding account',
            err.stack || err.message);
    }
}

async function checkZncaApiUseAllowed(app: App, window?: BrowserWindow, force = false) {
    if (!force) {
        if (await app.store.storage.getItem('ZncaApiConsent')) {
            return;
        }

        if (process.env.ZNC_PROXY_URL) {
            debug('Skipping znca API consent; znc proxy URL set');
            await app.store.storage.setItem('ZncaApiConsent', true);
            return;
        }

        const ids: string[] | undefined = await app.store.storage.getItem('NintendoAccountIds');

        for (const id of ids ?? []) {
            const nsotoken: string | undefined = await app.store.storage.getItem('NintendoAccountToken.' + id);
            if (!nsotoken) continue;

            debug('Skipping znca API consent; Nintendo Switch Online account already linked');
            await app.store.storage.setItem('ZncaApiConsent', true);
            return;
        }
    }

    if (await askZncaApiUseAllowed(app, window)) {
        await app.store.storage.setItem('ZncaApiConsent', true);
    } else {
        throw new Error('Cannot continue without third-party APIs allowed');
    }
}

async function askZncaApiUseAllowed(app?: App, window?: BrowserWindow): Promise<boolean> {
    const options: MessageBoxOptions = {
        message: app?.i18n.t('na_auth:znca_api_use.title') ?? 'Third-party API usage',
        detail: app?.i18n.t('na_auth:znca_api_use.text') ?? ZNCA_API_USE_TEXT,
        buttons: [
            app?.i18n.t('na_auth:znca_api_use.ok') ?? 'OK',
            app?.i18n.t('na_auth:znca_api_use.cancel') ?? 'Cancel',
            app?.i18n.t('na_auth:znca_api_use.more_information') ?? 'More information',
        ],
        cancelId: 1,
    };

    const result = window ?
        await dialog.showMessageBox(window, options) :
        await dialog.showMessageBox(options);

    debug('znca API consent', result);

    if (result.response === 2) {
        shell.openExternal(ZNCA_API_USE_URL);
        return askZncaApiUseAllowed(app, window);
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

export async function addPctlAccount(app: App, use_in_app_browser = true) {
    const {code, verifier, window} = use_in_app_browser ?
        await getSessionTokenCodeByInAppBrowser(app, ZNMA_CLIENT_ID, MOON_SCOPE, false) :
        await getSessionTokenCodeByDefaultBrowser(ZNMA_CLIENT_ID, MOON_SCOPE, false);

    window?.setFocusable(false);
    window?.blurWebView();

    try {
        const [jwt, sig] = Jwt.decode(code);

        const moontoken = await app.store.storage.getItem('NintendoAccountToken-pctl.' + jwt.payload.sub) as string | undefined;

        if (moontoken) {
            debug('Already authenticated', jwt.payload);

            try {
                const {moon, data} = await getPctlToken(app.store.storage, moontoken, false);

                new Notification({
                    title: app.i18n.t('na_auth:notification_moon.title') ?? 'Nintendo Switch Parental Controls',
                    body: app.i18n.t('na_auth:notification_moon.body_existing', {
                        na_name: data.user.nickname,
                        na_username: data.user.screenName,
                    }) ?? 'Already signed in as ' + data.user.nickname + ' (' + data.user.screenName + ')',
                }).show();

                return {moon, data};
            } catch (err) {
                if (err instanceof ErrorResponse && err.response.url.startsWith('https://accounts.nintendo.com/')) {
                    const data: NintendoAccountAuthError = err.data;

                    if (data.error === 'invalid_grant') {
                        // The session token has expired/was revoked
                        return authenticateMoonSessionToken(app, code, verifier, true);
                    }
                }

                throw err;
            }
        }

        return authenticateMoonSessionToken(app, code, verifier);
    } finally {
        window?.close();
    }
}

async function authenticateMoonSessionToken(
    app: App,
    code: string, verifier: string,
    reauthenticate = false,
) {
    const token = await getNintendoAccountSessionToken(code, verifier, ZNMA_CLIENT_ID);

    debug('session token', token);

    const {moon, data} = await getPctlToken(app.store.storage, token.session_token, false);

    const users = new Set(await app.store.storage.getItem('NintendoAccountIds') ?? []);
    users.add(data.user.id);
    await app.store.storage.setItem('NintendoAccountIds', [...users]);

    new Notification({
        title: app.i18n.t('na_auth:notification_moon.title') ?? 'Nintendo Switch Parental Controls',
        body: app.i18n.t('na_auth:notification_moon.body_' + (reauthenticate ? 're' : '') + 'authenticated', {
            na_name: data.user.nickname,
            na_username: data.user.screenName,
        }) ?? (reauthenticate ?
            'Reauthenticated to ' + data.user.nickname + ' (' + data.user.screenName + ')' :
            'Authenticated as ' + data.user.nickname + ' (' + data.user.screenName + ')'),
    }).show();

    return {moon, data};
}

export async function askAddPctlAccount(app: App, iab = true) {
    try {
        return await addPctlAccount(app, iab);
    } catch (err: any) {
        if (err instanceof AuthoriseError && err.code === 'access_denied') return;

        dialog.showErrorBox(app.i18n.t('na_auth:error.title') ?? 'Error adding account',
            err.stack || err.message);
    }
}
