import fetch from 'node-fetch';
import createDebug from 'debug';
import { ErrorResponse } from './util.js';
import { JwtPayload } from '../util.js';

const debug = createDebug('api:na');

export async function getNintendoAccountSessionToken(code: string, verifier: string, client_id: string) {
    debug('Getting Nintendo Account session token');

    const response = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/session_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Platform': 'Android',
            'X-ProductVersion': '2.0.0',
            'User-Agent': 'NASDKAPI; Android',
        },
        body: new URLSearchParams({
            client_id,
            session_token_code: code,
            session_token_code_verifier: verifier,
        }).toString(),
    });

    const token = await response.json() as NintendoAccountSessionToken | NintendoAccountError;

    if ('errorCode' in token) {
        throw new ErrorResponse('[na] + ' + token.detail, response, token);
    }

    debug('Got Nintendo Account session token', token);

    return token;
}

export async function getNintendoAccountToken(token: string, client_id: string) {
    debug('Getting Nintendo Account token');

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
    });

    const nintendoAccountToken = await response.json() as NintendoAccountToken | NintendoAccountError;

    if ('errorCode' in nintendoAccountToken) {
        throw new ErrorResponse('[na] + ' + nintendoAccountToken.detail, response, nintendoAccountToken);
    }

    debug('Got Nintendo Account token', nintendoAccountToken);

    return nintendoAccountToken;
}

export async function getNintendoAccountUser(token: NintendoAccountToken) {
    debug('Getting Nintendo Account user info');

    const response = await fetch('https://api.accounts.nintendo.com/2.0.0/users/me', {
        headers: {
            'Accept-Language': 'en-GB',
            'User-Agent': 'NASDKAPI; Android',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token.access_token!,
        },
    });

    const user = await response.json() as NintendoAccountUser | NintendoAccountError;

    if ('errorCode' in user) {
        throw new ErrorResponse('[na] + ' + user.detail, response, user);
    }

    debug('Got Nintendo Account user info', user);

    return user;
}

export interface NintendoAccountSessionToken {
    session_token: string;
    code: string;
}
export interface NintendoAccountSessionTokenJwtPayload extends JwtPayload {
    jti: string;
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
    mii: {
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
    };
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

export interface NintendoAccountError {
    errorCode: string;
    detail: string;
    instance: string;
    title: string;
    status: number;
    type: string;
}
