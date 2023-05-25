import createDebug from 'debug';
import * as persist from 'node-persist';
import { Response } from 'node-fetch';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';
import { Jwt } from '../../util/jwt.js';
import { CoralErrorResponse } from '../../api/coral-types.js';
import CoralApi, { CoralAuthData, ZNCA_CLIENT_ID } from '../../api/coral.js';
import ZncProxyApi from '../../api/znc-proxy.js';
import { checkUseLimit, SHOULD_LIMIT_USE } from './util.js';

const debug = createDebug('nxapi:auth:coral');

export const Login = Symbol('Login');

export interface SavedToken extends CoralAuthData {
    expires_at: number;
    proxy_url?: string;
    /** Indicates we just logged in and didn't use a cached token */
    [Login]?: boolean;
}

export async function getToken(
    storage: persist.LocalStorage, token: string, proxy_url: string, ratelimit?: boolean
): Promise<{
    nso: ZncProxyApi;
    data: SavedToken;
}>
export async function getToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string, ratelimit?: boolean
): Promise<{
    nso: CoralApi;
    data: SavedToken;
}>
export async function getToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string, ratelimit = SHOULD_LIMIT_USE
) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

    if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
        throw new Error('Invalid Nintendo Account session token issuer');
    }
    if (jwt.payload.typ !== 'session_token') {
        throw new Error('Invalid Nintendo Account session token type');
    }
    if (jwt.payload.aud !== ZNCA_CLIENT_ID) {
        throw new Error('Invalid Nintendo Account session token audience');
    }
    if (jwt.payload.exp <= (Date.now() / 1000)) {
        throw new Error('Nintendo Account session token expired');
    }

    // Nintendo Account session tokens use a HMAC SHA256 signature, so we can't verify this is valid

    const existingToken: SavedToken | undefined = await storage.getItem('NsoToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        await checkUseLimit(storage, 'coral', jwt.payload.sub, ratelimit);

        console.warn('Authenticating to Nintendo Switch Online app');
        debug('Authenticating to znc with session token');

        const {nso, data} = proxy_url ?
            await ZncProxyApi.createWithSessionToken(proxy_url, token) :
            await CoralApi.createWithSessionToken(token);

        const existingToken: SavedToken = {
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        nso.onTokenExpired = createTokenExpiredHandler(storage, token, nso, {existingToken});

        await storage.setItem('NsoToken.' + token, existingToken);
        await storage.setItem('NintendoAccountToken.' + data.user.id, token);

        existingToken[Login] = true;

        return {nso, data: existingToken};
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken.' + existingToken.user.id, token);

    const nso = proxy_url ?
        new ZncProxyApi(proxy_url, token) :
        CoralApi.createWithSavedToken(existingToken);

    nso.onTokenExpired = createTokenExpiredHandler(storage, token, nso, {existingToken});

    return {nso, data: existingToken};
}

function createTokenExpiredHandler(
    storage: persist.LocalStorage, token: string, nso: CoralApi,
    renew_token_data: {existingToken: SavedToken}, ratelimit = true
) {
    return (data?: CoralErrorResponse, response?: Response) => {
        debug('Token expired', renew_token_data.existingToken.user.id, data);
        return renewToken(storage, token, nso, renew_token_data, ratelimit);
    };
}

async function renewToken(
    storage: persist.LocalStorage, token: string, nso: CoralApi,
    renew_token_data: {existingToken: SavedToken}, ratelimit = true
) {
    if (ratelimit) {
        const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);    
        await checkUseLimit(storage, 'coral', jwt.payload.sub, ratelimit);
    }

    const data = await nso.renewToken(token, renew_token_data.existingToken.user);

    const existingToken: SavedToken = {
        ...renew_token_data.existingToken,
        ...data,
        expires_at: Date.now() + (data.credential.expiresIn * 1000),
    };

    await storage.setItem('NsoToken.' + token, existingToken);
    renew_token_data.existingToken = existingToken;
}
