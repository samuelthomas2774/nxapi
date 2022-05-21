import createDebug from 'debug';
import * as persist from 'node-persist';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';
import { NintendoAccountSessionTokenJwtPayload, NintendoAccountToken, NintendoAccountUser } from '../../api/na.js';
import { Jwt } from '../../util.js';
import MoonApi from '../../api/moon.js';

const debug = createDebug('nxapi:auth:moon');

export interface SavedMoonToken {
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;

    expires_at: number;
}

export async function getPctlToken(storage: persist.LocalStorage, token: string) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi pctl auth`.');
        throw new Error('Invalid token');
    }

    const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

    if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
        throw new Error('Invalid Nintendo Account session token issuer');
    }
    if (jwt.payload.typ !== 'session_token') {
        throw new Error('Invalid Nintendo Account session token type');
    }
    if (jwt.payload.aud !== ZNMA_CLIENT_ID) {
        throw new Error('Invalid Nintendo Account session token audience');
    }
    if (jwt.payload.exp <= (Date.now() / 1000)) {
        throw new Error('Nintendo Account session token expired');
    }

    // Nintendo Account session tokens use a HMAC SHA256 signature, so we can't verify this is valid

    const existingToken: SavedMoonToken | undefined = await storage.getItem('MoonToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        console.warn('Authenticating to Nintendo Switch Parental Controls app');
        debug('Authenticating to pctl with session token');

        const {moon, data} = await MoonApi.createWithSessionToken(token);

        const existingToken: SavedMoonToken = {
            ...data,
            expires_at: Date.now() + (data.nintendoAccountToken.expires_in * 1000),
        };

        await storage.setItem('MoonToken.' + token, existingToken);
        await storage.setItem('NintendoAccountToken-pctl.' + data.user.id, token);

        return {moon, data: existingToken};
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken-pctl.' + existingToken.user.id, token);

    return {
        moon: new MoonApi(existingToken.nintendoAccountToken.access_token!, existingToken.user.id),
        data: existingToken,
    };
}
