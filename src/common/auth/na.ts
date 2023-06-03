import * as persist from 'node-persist';
import { getNintendoAccountToken, NintendoAccountSessionTokenJwtPayload, NintendoAccountToken } from '../../api/na.js';
import createDebug from '../../util/debug.js';
import { Jwt } from '../../util/jwt.js';
import { checkUseLimit, LIMIT_REQUESTS, SHOULD_LIMIT_USE } from './util.js';

const debug = createDebug('nxapi:auth:na');

// Higher rate limit for Nintendo Accounts, as the token expires sooner
const LIMIT_PERIOD = 15 * 60 * 1000; // 15 minutes

export interface SavedNintendoAccountToken {
    token: NintendoAccountToken;
    expires_at: number;
}

export async function getNaToken(
    storage: persist.LocalStorage, na_session_token: string, client_id: string, ratelimit = SHOULD_LIMIT_USE,
) {
    const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(na_session_token);

    if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
        throw new Error('Invalid Nintendo Account session token issuer');
    }
    if (jwt.payload.typ !== 'session_token') {
        throw new Error('Invalid Nintendo Account session token type');
    }
    if (jwt.payload.aud !== client_id) {
        throw new Error('Invalid Nintendo Account session token audience');
    }
    if (jwt.payload.exp <= (Date.now() / 1000)) {
        throw new Error('Nintendo Account session token expired');
    }

    // Nintendo Account session tokens use a HMAC SHA256 signature, so we can't verify this is valid

    const existingToken: SavedNintendoAccountToken | undefined =
        await storage.getItem('NaToken.' + na_session_token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        await checkUseLimit(storage, 'na', jwt.payload.sub, ratelimit, [LIMIT_REQUESTS, LIMIT_PERIOD]);

        console.warn('Authenticating to Nintendo Accounts');
        debug('Authenticating with session token');

        const token = await getNintendoAccountToken(na_session_token, client_id);

        const existingToken: SavedNintendoAccountToken = {
            token,
            expires_at: Date.now() + (token.expires_in * 1000),
        };

        await storage.setItem('NaToken.' + na_session_token, existingToken);

        return existingToken;
    }

    debug('Using existing token');

    return existingToken;
}
