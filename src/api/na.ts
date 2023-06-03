import * as crypto from 'node:crypto';
import fetch, { Response } from 'node-fetch';
import { defineResponse, ErrorResponse, HasResponse } from './util.js';
import createDebug from '../util/debug.js';
import { JwtPayload } from '../util/jwt.js';
import { timeoutSignal } from '../util/misc.js';

const debug = createDebug('nxapi:api:na');

export class NintendoAccountSessionAuthorisation {
    readonly scope: string;

    protected constructor(
        readonly client_id: string,
        scope: string | string[],
        readonly authorise_url: string,
        readonly state: string,
        readonly verifier: string,
        readonly redirect_uri = 'npf' + client_id + '://auth',
    ) {
        this.scope = typeof scope === 'string' ? scope : scope.join(' ');
    }

    async getSessionToken(code: string, state?: string): Promise<HasResponse<NintendoAccountSessionToken, Response>>
    async getSessionToken(params: URLSearchParams): Promise<HasResponse<NintendoAccountSessionToken, Response>>
    async getSessionToken(code: string | URLSearchParams | null, state?: string | null) {
        if (code instanceof URLSearchParams) {
            if (code.get('state') !== this.state) {
                throw new TypeError('Invalid state');
            }

            if (code.has('error')) {
                throw NintendoAccountSessionAuthorisationError.fromSearchParams(code);
            }

            code = code.get('session_token_code');
            state = undefined;
        }

        if (typeof state !== 'undefined' && state !== this.state) {
            throw new TypeError('Invalid state');
        }

        if (typeof code !== 'string' || !code) {
            throw new TypeError('Invalid code');
        }

        return getNintendoAccountSessionToken(code, this.verifier, this.client_id);
    }

    static create(
        client_id: string,
        scope: string | string[],
        /** @internal */ redirect_uri = 'npf' + client_id + '://auth',
    ) {
        if (typeof scope !== 'string') scope = scope.join(' ');

        const auth_data = generateAuthData(client_id, scope, redirect_uri);

        return new NintendoAccountSessionAuthorisation(client_id, scope,
            auth_data.url, auth_data.state, auth_data.verifier, redirect_uri);
    }
}

export class NintendoAccountSessionAuthorisationError extends Error {
    constructor(readonly code: string, message?: string) {
        super(message);
    }

    static fromSearchParams(qs: URLSearchParams) {
        const code = qs.get('error') ?? 'unknown_error';
        const message = qs.get('error_description') ?? code;

        return new NintendoAccountSessionAuthorisationError(code, message);
    }
}

export function generateAuthData(
    client_id: string,
    scope: string | string[],
    redirect_uri = 'npf' + client_id + '://auth',
) {
    const state = crypto.randomBytes(36).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest().toString('base64url');

    const params = {
        state,
        redirect_uri,
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

export async function getNintendoAccountSessionToken(code: string, verifier: string, client_id: string) {
    debug('Getting Nintendo Account session token');

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/session_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'NASDKAPI; Android',
        },
        body: new URLSearchParams({
            client_id,
            session_token_code: code,
            session_token_code_verifier: verifier,
        }).toString(),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse('[na] Non-200 status code', response, await response.text());
    }

    const token = await response.json() as NintendoAccountSessionToken | NintendoAccountAuthError | NintendoAccountError;

    if ('errorCode' in token) {
        throw new ErrorResponse<NintendoAccountError>('[na] ' + token.detail, response, token);
    }
    if ('error' in token) {
        throw new ErrorResponse<NintendoAccountAuthError>('[na] ' + token.error_description ?? token.error, response, token);
    }

    debug('Got Nintendo Account session token', token);

    return defineResponse(token, response);
}

export async function getNintendoAccountToken(token: string, client_id: string) {
    debug('Getting Nintendo Account token');

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 8.0.0)',
        },
        body: JSON.stringify({
            client_id,
            session_token: token,
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
        }),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse('[na] Non-200 status code', response, await response.text());
    }

    const nintendoAccountToken = await response.json() as NintendoAccountToken | NintendoAccountAuthError | NintendoAccountError;

    if ('errorCode' in nintendoAccountToken) {
        throw new ErrorResponse<NintendoAccountError>('[na] ' + nintendoAccountToken.detail, response, nintendoAccountToken);
    }
    if ('error' in nintendoAccountToken) {
        throw new ErrorResponse<NintendoAccountAuthError>('[na] ' + nintendoAccountToken.error_description ?? nintendoAccountToken.error, response, nintendoAccountToken);
    }

    debug('Got Nintendo Account token', nintendoAccountToken);

    return defineResponse(nintendoAccountToken, response);
}

export async function getNintendoAccountUser(token: NintendoAccountToken) {
    debug('Getting Nintendo Account user info');

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://api.accounts.nintendo.com/2.0.0/users/me', {
        headers: {
            'Accept-Language': 'en-GB',
            'User-Agent': 'NASDKAPI; Android',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token.access_token!,
        },
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse('[na] Non-200 status code', response, await response.text());
    }

    const user = await response.json() as NintendoAccountUser | NintendoAccountError;

    if ('errorCode' in user) {
        throw new ErrorResponse<NintendoAccountError>('[na] ' + user.detail, response, user);
    }

    debug('Got Nintendo Account user info', user);

    return defineResponse(user, response);
}

export interface NintendoAccountSessionToken {
    session_token: string;
    code: string;
}
export interface NintendoAccountSessionTokenJwtPayload extends JwtPayload {
    jti: number;
    typ: 'session_token';
    iss: 'https://accounts.nintendo.com';
    /** Unknown - scopes the token is valid for? */
    'st:scp': number[];
    /** Subject (Nintendo Account ID) */
    sub: string;
    exp: number;
    /** Audience (client ID) */
    aud: string;
    iat: number;
}

export interface NintendoAccountToken {
    scope: string[];
    token_type: 'Bearer';
    id_token: string;
    access_token?: string;
    expires_in: 900;
}
export interface NintendoAccountIdTokenJwtPayload extends JwtPayload {
    /** Subject (Nintendo Account ID) */
    sub: string;
    iat: number;
    exp: number;
    /** Audience (client ID) */
    aud: string;
    iss: 'https://accounts.nintendo.com';
    jti: string;
    at_hash: string; // ??
    typ: 'id_token';
    country: string;
}
export interface NintendoAccountAccessTokenJwtPayload extends JwtPayload {
    iss: 'https://accounts.nintendo.com';
    jti: string;
    typ: 'token';
    /** Subject (Nintendo Account ID) */
    sub: string;
    iat: number;
    'ac:grt': number; // ??
    'ac:scp': number[]; // ??
    exp: number;
    /** Audience (client ID) */
    aud: string;
}

export enum NintendoAccountScope {
    OPENID = 'openid', // Used by NSO, PCTL, nintendo.co.uk
    OFFLINE = 'offline', // Used by ec
    USER = 'user', // Used by NSO, PCTL, nintendo.co.uk
    USER_BIRTHDAY = 'user.birthday', // Used by NSO, PCTL, nintendo.co.uk
    USER_MII = 'user.mii', // Used by NSO, nintendo.co.uk
    USER_SCREENNAME = 'user.screenName', // Used by NSO
    USER_EMAIL = 'user.email', // Used by nintendo.co.uk
    USER_LINKS = 'user.links[].id', // Used by nintendo.co.uk
    USER_LINKS_NNID = 'user.links.nintendoNetwork.id', // Used by ec
    USER_MEMBERSHIP = 'user.membership', // Used by nintendo.co.uk
    USER_WISHLIST = 'user.wishlist', // Used by nintendo.co.uk
    ESHOP_DEMO = 'eshopDemo', // Used by nintendo.co.uk
    ESHOP_DEVICE = 'eshopDevice', // Used by nintendo.co.uk
    ESHOP_PRICE = 'eshopPrice', // Used by nintendo.co.uk
    MISSIONSTATUS = 'missionStatus', // Used by nintendo.co.uk
    MISSIONSTATUS_PROGRESS = 'missionStatus:progress', // Used by nintendo.co.uk
    POINTWALLET = 'pointWallet', // Used by nintendo.co.uk
    USERNOTIFICATIONMESSAGE_ANYCLIENTS = 'userNotificationMessage:anyClients', // Used by nintendo.co.uk
    USERNOTIFICATIONMESSAGE_ANYCLIENTS_WRITE = 'userNotificationMessage:anyClients:write', // Used by nintendo.co.uk
    MOONUSER_ADMINISTRATION = 'moonUser:administration', // Used by PCTL
    MOONDEVICE_CREATE = 'moonDevice:create', // Used by PCTL
    MOONOWNEDDEVICE_ADMINISTRATION = 'moonOwnedDevice:administration', // Used by PCTL
    MOONPARENTALCONTROLSETTING = 'moonParentalControlSetting', // Used by PCTL
    MOONPARENTALCONTROLSETTING_UPDATE = 'moonParentalControlSetting:update', // Used by PCTL
    MOONPARENTALCONTROLSETTINGSTATE = 'moonParentalControlSettingState', // Used by PCTL
    MOONPAIRINGSTATE = 'moonPairingState', // Used by PCTL
    MOONSMARTDEVICE_ADMINISTRATION = 'moonSmartDevice:administration', // Used by PCTL
    MOONDAILYSUMMARY = 'moonDailySummary', // Used by PCTL
    MOONMONTHLYSUMMARY = 'moonMonthlySummary', // Used by PCTL
}
export enum NintendoAccountJwtScope {
    'openid' = 0,
    'user' = 8,
    'user.birthday' = 9,
    'user.mii' = 17,
    'user.screenName' = 23,
    'moonUser:administration' = 320,
    'moonDevice:create' = 321,
    'moonOwnedDevice:administration' = 325,
    'moonParentalControlSetting' = 322,
    'moonParentalControlSetting:update' = 323,
    'moonParentalControlSettingState' = 324,
    'moonPairingState' = 326,
    'moonSmartDevice:administration' = 327,
    'moonDailySummary' = 328,
    'moonMonthlySummary' = 329,

    // 10, 12, 70, 81, 198, 288, 289, 291, 292, 356, 357, 376
    // 'user.email' = -1,
    // 'user.links[].id' = -1,
    // 'user.membership' = -1,
    // 'user.wishlist' = -1,
    // 'eshopDemo' = -1,
    // 'eshopDevice' = -1,
    // 'eshopPrice' = -1,
    // 'missionStatus' = -1,
    // 'missionStatus:progress' = -1,
    // 'pointWallet' = -1,
    // 'userNotificationMessage:anyClients' = -1,
    // 'userNotificationMessage:anyClients:write' = -1,

    // 1, 31
    // 'offline' = -1,
    // 'user.links.nintendoNetwork.id' = -1,
}

export interface NintendoAccountUser {
    emailOptedIn: boolean;
    language: string;
    country: string;
    timezone: {
        name: string;
        id: string;
        utcOffsetSeconds: number;
        utcOffset: string;
    };
    region: null;
    nickname: string;
    clientFriendsOptedIn: boolean;
    mii: Mii | null;
    isChild: boolean;
    eachEmailOptedIn: {
        survey: {
            updatedAt: number;
            optedIn: boolean;
        };
        deals: {
            updatedAt: number;
            optedIn: boolean;
        };
    };
    updatedAt: number;
    candidateMiis: unknown[];
    id: string;
    createdAt: number;
    emailVerified: boolean;
    analyticsPermissions: {
        internalAnalysis: {
            updatedAt: number;
            permitted: boolean;
        };
        targetMarketing: {
            updatedAt: number;
            permitted: boolean;
        };
    };
    emailOptedInUpdatedAt: number;
    birthday: string;
    screenName: string;
    gender: string;
    analyticsOptedInUpdatedAt: number;
    analyticsOptedIn: boolean;
    clientFriendsOptedInUpdatedAt: number;
}

export interface Mii {
    favoriteColor: string;
    id: string;
    updatedAt: number;
    coreData: {
        '4': string;
    };
    clientId: '1cfe3a55ed8924d9';
    imageUriTemplate: string;
    storeData: {
        '3': string;
    };
    imageOrigin: string;
    etag: string;
    type: 'profile';
}

export interface NintendoAccountAuthError {
    error: string;
    error_description: string;
}

export interface NintendoAccountError {
    errorCode: string;
    detail: string;
    instance: string;
    title: string;
    status: number;
    type: string;
}
