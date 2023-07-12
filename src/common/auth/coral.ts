import * as persist from 'node-persist';
import { Response } from 'undici';
import CoralApi, { CoralAuthData, ZNCA_CLIENT_ID } from '../../api/coral.js';
import { CoralError } from '../../api/coral-types.js';
import ZncProxyApi from '../../api/znc-proxy.js';
import { getNintendoAccountUser, NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';
import createDebug from '../../util/debug.js';
import { Jwt } from '../../util/jwt.js';
import { checkUseLimit, SHOULD_LIMIT_USE } from './util.js';
import { getNaToken } from './na.js';

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
    storage: persist.LocalStorage, token: string, proxy_url?: undefined, ratelimit?: boolean
): Promise<{
    nso: CoralApi;
    data: SavedToken;
}>
export async function getToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string, ratelimit?: boolean
): Promise<{
    nso: CoralApi | ZncProxyApi;
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
        const attempt = await checkUseLimit(storage, 'coral', jwt.payload.sub, ratelimit);

        console.warn('Authenticating to Nintendo Switch Online app');

        try {
            const {nso, data} = proxy_url ?
                await ZncProxyApi.createWithSessionToken(proxy_url, token) :
                await createWithSessionToken(storage, token, ratelimit);

            const existingToken: SavedToken = {
                ...data,
                expires_at: Date.now() + (data.credential.expiresIn * 1000),
            };

            if (nso instanceof CoralApi) {
                nso.onTokenExpired = createTokenExpiredHandler(storage, token, nso, {existingToken});
            }

            await storage.setItem('NsoToken.' + token, existingToken);
            await storage.setItem('NintendoAccountToken.' + data.user.id, token);

            existingToken[Login] = true;

            return {nso, data: existingToken};
        } catch (err) {
            await attempt.recordError(err);

            throw err;
        }
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken.' + existingToken.user.id, token);

    const nso = proxy_url ?
        new ZncProxyApi(proxy_url, token) :
        CoralApi.createWithSavedToken(existingToken);

    if (nso instanceof CoralApi) {
        nso.onTokenExpired = createTokenExpiredHandler(storage, token, nso, {existingToken});
    }

    return {nso, data: existingToken};
}

async function createWithSessionToken(
    storage: persist.LocalStorage, na_session_token: string, ratelimit = true
) {
    const na_token = await getNaToken(storage, na_session_token, ZNCA_CLIENT_ID, ratelimit);
    const user = await getNintendoAccountUser(na_token.token);

    debug('Authenticating to coral');

    return CoralApi.createWithNintendoAccountToken(na_token.token, user);
}

function createTokenExpiredHandler(
    storage: persist.LocalStorage, token: string, nso: CoralApi,
    renew_token_data: {existingToken: SavedToken}, ratelimit = true
) {
    return (data?: CoralError, response?: Response) => {
        debug('Token expired', renew_token_data.existingToken.user.id, data);
        return renewToken(storage, token, nso, renew_token_data, ratelimit);
    };
}

async function renewToken(
    storage: persist.LocalStorage, na_session_token: string, nso: CoralApi,
    renew_token_data: {existingToken: SavedToken}, ratelimit = true
) {
    let attempt;
    if (ratelimit) {
        const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(na_session_token);    
        attempt = await checkUseLimit(storage, 'coral', jwt.payload.sub, ratelimit);
    }

    try {
        const na_token = await getNaToken(storage, na_session_token, ZNCA_CLIENT_ID, ratelimit);

        debug('Reauthenticating to coral');

        const data = await nso.renewTokenWithNintendoAccountToken(na_token.token, renew_token_data.existingToken.user);

        const existingToken: SavedToken = {
            ...renew_token_data.existingToken,
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        await storage.setItem('NsoToken.' + na_session_token, existingToken);
        renew_token_data.existingToken = existingToken;
    } catch (err) {
        await attempt?.recordError(err);

        throw err;
    }
}
