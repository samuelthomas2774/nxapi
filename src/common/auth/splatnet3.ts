import createDebug from 'debug';
import persist from 'node-persist';
import { Response } from 'node-fetch';
import { getToken, Login } from './coral.js';
import SplatNet3Api, { SplatNet3AuthData } from '../../api/splatnet3.js';
import { checkUseLimit, SHOULD_LIMIT_USE } from './util.js';
import { Jwt } from '../../util/jwt.js';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';

const debug = createDebug('nxapi:auth:splatnet3');

export interface SavedBulletToken extends SplatNet3AuthData {}

export async function getBulletToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string,
    allow_fetch_token = false, ratelimit = SHOULD_LIMIT_USE
) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedBulletToken | undefined = await storage.getItem('BulletToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        if (!allow_fetch_token) {
            throw new Error('No valid bullet_token');
        }

        const { default: { coral_gws_splatnet3: config } } = await import('../remote-config.js');
        if (!config) throw new Error('Remote configuration prevents SplatNet 3 authentication');

        if (ratelimit) {
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);
            await checkUseLimit(storage, 'splatnet3', jwt.payload.sub);
        }

        console.warn('Authenticating to SplatNet 3');
        debug('Authenticating to SplatNet 3');

        const {nso, data} = await getToken(storage, token, proxy_url);

        if (data[Login]) {
            const announcements = await nso.getAnnouncements();
            const friends = await nso.getFriendList();
            const webservices = await nso.getWebServices();
            const activeevent = await nso.getActiveEvent();
        }

        const existingToken: SavedBulletToken = await SplatNet3Api.loginWithCoral(nso, data.user);

        await storage.setItem('BulletToken.' + token, existingToken);

        const splatnet = SplatNet3Api.createWithSavedToken(existingToken);
        splatnet.onTokenExpired = createTokenExpiredHandler(storage, token, splatnet, existingToken, proxy_url);
        splatnet.onTokenShouldRenew = createTokenShouldRenewHandler(storage, token, splatnet, existingToken, proxy_url);

        return {splatnet, data: existingToken};
    }

    debug('Using existing token');

    const splatnet = SplatNet3Api.createWithSavedToken(existingToken);

    if (allow_fetch_token) {
        splatnet.onTokenExpired = createTokenExpiredHandler(storage, token, splatnet, existingToken, proxy_url);
        splatnet.onTokenShouldRenew = createTokenShouldRenewHandler(storage, token, splatnet, existingToken, proxy_url);
    }

    return {splatnet, data: existingToken};
}

function createTokenExpiredHandler(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api, existingToken: SavedBulletToken,
    znc_proxy_url?: string
) {
    return (response: Response) => {
        debug('Token expired, renewing');
        return renewToken(storage, token, splatnet, existingToken, znc_proxy_url);
    };
}

function createTokenShouldRenewHandler(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api, existingToken: SavedBulletToken,
    znc_proxy_url?: string
) {
    return (remaining: number, response: Response) => {
        debug('Token will expire in %d seconds, renewing', remaining);
        return renewToken(storage, token, splatnet, existingToken, znc_proxy_url);
    };
}

async function renewToken(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api, previousToken: SavedBulletToken,
    znc_proxy_url?: string
) {
    const {nso, data} = await getToken(storage, token, znc_proxy_url);

    if (data[Login]) {
        const announcements = await nso.getAnnouncements();
        const friends = await nso.getFriendList();
        const webservices = await nso.getWebServices();
        const activeevent = await nso.getActiveEvent();
    }

    const existingToken: SavedBulletToken = await SplatNet3Api.loginWithCoral(nso, data.user);

    splatnet.bullet_token = existingToken.bullet_token.bulletToken;
    splatnet.version = existingToken.version;
    splatnet.language = existingToken.bullet_token.lang;
    splatnet.useragent = existingToken.useragent;

    await storage.setItem('BulletToken.' + token, existingToken);
}
