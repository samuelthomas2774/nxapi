import persist from 'node-persist';
import { Response } from 'undici';
import { getToken, Login, SavedToken } from './coral.js';
import SplatNet3Api, { SPLATNET3_WEBSERVICE_ID, SplatNet3AuthData, SplatNet3AuthErrorCode, SplatNet3AuthErrorResponse } from '../../api/splatnet3.js';
import { checkMembershipActive, checkUseLimit, SHOULD_LIMIT_USE } from './util.js';
import createDebug from '../../util/debug.js';
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

        const {nso, data} = await getToken(storage, token, proxy_url);

        const [friends, chats, webservices, activeevent, media, announcements, current_user] = data[Login] || true ? await Promise.all([
            nso.getFriendList(),
            nso.getChats(),
            nso.getWebServices(),
            nso.getActiveEvent(),
            nso.getMedia(),
            nso.getAnnouncements(),
            nso.getCurrentUser(),
        ]) : [];

        const webservice = webservices!.find(w => w.id === SPLATNET3_WEBSERVICE_ID);
        if (!webservice) throw new Error('Invalid web service');

        const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');
        if (verifymembership?.attrValue === 'true') checkMembershipActive(data);

        let attempt;
        if (ratelimit) {
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);
            attempt = await checkUseLimit(storage, 'splatnet3', jwt.payload.sub);
        }

        try {
            console.warn('Authenticating to SplatNet 3');
            debug('Authenticating to SplatNet 3');

            const existingToken: SavedBulletToken = await SplatNet3Api.loginWithCoral(nso, data.user);

            await storage.setItem('BulletToken.' + token, existingToken);

            const splatnet = SplatNet3Api.createWithSavedToken(existingToken);

            const renew_token_data = {existingToken, znc_proxy_url: proxy_url};
            splatnet.onTokenExpired = createTokenExpiredHandler(storage, token, splatnet, renew_token_data);
            splatnet.onTokenShouldRenew = createTokenShouldRenewHandler(storage, token, splatnet, renew_token_data);

            return {splatnet, data: existingToken};
        } catch (err) {
            await attempt?.recordError(err);

            throw err;
        }
    }

    debug('Using existing token');

    const splatnet = SplatNet3Api.createWithSavedToken(existingToken);

    if (allow_fetch_token) {
        const renew_token_data = {existingToken, znc_proxy_url: proxy_url};
        splatnet.onTokenExpired = createTokenExpiredHandler(storage, token, splatnet, renew_token_data);
        splatnet.onTokenShouldRenew = createTokenShouldRenewHandler(storage, token, splatnet, renew_token_data);
    }

    return {splatnet, data: existingToken};
}

function createTokenExpiredHandler(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api,
    data: {existingToken: SavedBulletToken; znc_proxy_url?: string},
    ratelimit = true
) {
    return (response?: Response) => {
        debug('Token expired, renewing');
        return renewToken(storage, token, splatnet, data, ratelimit);
    };
}

function createTokenShouldRenewHandler(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api,
    data: {existingToken: SavedBulletToken; znc_proxy_url?: string},
    ratelimit = true
) {
    return (remaining: number, response: Response) => {
        debug('Token will expire in %d seconds, renewing', remaining);
        return renewToken(storage, token, splatnet, data, ratelimit);
    };
}

async function renewToken(
    storage: persist.LocalStorage, token: string, splatnet: SplatNet3Api,
    renew_token_data: {existingToken: SavedBulletToken; znc_proxy_url?: string},
    ratelimit = true
) {
    if (ratelimit) {
        const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);
        await checkUseLimit(storage, 'splatnet3', jwt.payload.sub);
    }

    try {
        const data: SavedToken | undefined = await storage.getItem('NsoToken.' + token);

        if (data) {
            const existingToken: SavedBulletToken =
                await splatnet.renewTokenWithWebServiceToken(renew_token_data.existingToken.webserviceToken, data.user);

            await storage.setItem('BulletToken.' + token, existingToken);
            renew_token_data.existingToken = existingToken;

            return;
        } else {
            debug('Unable to renew bullet token with saved web services token - cached data for this session token doesn\'t exist??');
        }
    } catch (err) {
        if (err instanceof SplatNet3AuthErrorResponse && err.code === SplatNet3AuthErrorCode.ERROR_INVALID_GAME_WEB_TOKEN) {
            // Web service token invalid/expired...
            debug('Web service token expired, authenticating with new token', err);
        } else {
            throw err;
        }
    }

    const {nso, data} = await getToken(storage, token, renew_token_data.znc_proxy_url);

    const [friends, chats, webservices, activeevent, media, announcements, current_user] = data[Login] || true ? await Promise.all([
        nso.getFriendList(),
        nso.getChats(),
        nso.getWebServices(),
        nso.getActiveEvent(),
        nso.getMedia(),
        nso.getAnnouncements(),
        nso.getCurrentUser(),
    ]) : [];

    const existingToken: SavedBulletToken = await splatnet.renewTokenWithCoral(nso, data.user);

    await storage.setItem('BulletToken.' + token, existingToken);
    renew_token_data.existingToken = existingToken;
}
