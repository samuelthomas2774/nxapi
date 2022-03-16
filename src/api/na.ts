import fetch from 'node-fetch';
import createDebug from 'debug';
import { ErrorResponse } from './util.js';

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

export interface NintendoAccountToken {
    scope: string[];
    token_type: 'Bearer';
    id_token: string;
    access_token?: string;
    expires_in: 900;
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
