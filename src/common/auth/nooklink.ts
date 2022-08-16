import createDebug from 'debug';
import persist from 'node-persist';
import { getToken, Login } from './coral.js';
import NooklinkApi, { NooklinkUserApi } from '../../api/nooklink.js';
import { AuthToken, Users } from '../../api/nooklink-types.js';
import { WebServiceToken } from '../../api/coral-types.js';
import { checkUseLimit, SHOULD_LIMIT_USE } from './util.js';
import { Jwt } from '../../util/jwt.js';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';

const debug = createDebug('nxapi:auth:nooklink');

export interface SavedToken {
    webserviceToken: WebServiceToken;
    url: string;
    cookies: string;
    body: string;

    gtoken: string;
    expires_at: number;
    useragent: string;
}

export async function getWebServiceToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string,
    allow_fetch_token = false, ratelimit = SHOULD_LIMIT_USE
) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedToken | undefined = await storage.getItem('NookToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        if (!allow_fetch_token) {
            throw new Error('No valid NookLink web service token');
        }

        if (ratelimit) {
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);
            await checkUseLimit(storage, 'nooklink', jwt.payload.sub);
        }

        console.warn('Authenticating to NookLink');
        debug('Authenticating to NookLink');

        const {nso, data} = await getToken(storage, token, proxy_url);

        if (data[Login]) {
            const announcements = await nso.getAnnouncements();
            const friends = await nso.getFriendList();
            const webservices = await nso.getWebServices();
            const activeevent = await nso.getActiveEvent();
        }

        const existingToken: SavedToken = await NooklinkApi.loginWithCoral(nso, data.user);

        await storage.setItem('NookToken.' + token, existingToken);

        return {
            nooklink: new NooklinkApi(existingToken.gtoken, existingToken.useragent),
            data: existingToken,
        };
    }

    debug('Using existing web service token');

    return {
        nooklink: new NooklinkApi(existingToken.gtoken, existingToken.useragent),
        data: existingToken,
    };
}

export interface SavedUserToken {
    token: AuthToken;
    user: string;
    webserviceToken: SavedToken;
}

type PromiseValue<T> = T extends PromiseLike<infer R> ? R : never;

export async function getUserToken(
    storage: persist.LocalStorage, nintendoAccountToken: string, user?: string,
    proxy_url?: string, allow_fetch_token = false, ratelimit = SHOULD_LIMIT_USE
) {
    let wst: PromiseValue<ReturnType<typeof getWebServiceToken>> | null = null;

    if (!user) {
        let cachedUsers: {
            users: Users;
            expires_at: number;
        } | undefined = await storage.getItem('NookUsers.' + nintendoAccountToken);

        if (!cachedUsers || cachedUsers.expires_at <= Date.now()) {
            if (!wst) wst = await getWebServiceToken(storage, nintendoAccountToken, proxy_url, allow_fetch_token);
            const {nooklink, data: webserviceToken} = wst;

            debug('Fetching users');
            const users = await nooklink.getUsers();

            await storage.setItem('NookUsers.' + nintendoAccountToken, cachedUsers = {
                users,
                expires_at: webserviceToken.expires_at,
            });
        }

        if (!cachedUsers.users.users.length) {
            throw new Error('No Animal Crossing: New Horizons save data linked to NookLink');
        }

        if (cachedUsers.users.users.length > 1) {
            console.warn('More than 1 NookLink user is linked to this Nintendo Account. The first player will be used. Use `--islander` to set a specific user.');
        }

        user = cachedUsers.users.users[0].id;
    }

    const existingToken: SavedUserToken | undefined = await storage.getItem('NookAuthToken.' + nintendoAccountToken + '.' + user);

    if (!existingToken || existingToken.token.expireAt <= (Date.now() / 1000)) {
        if (!wst) wst = await getWebServiceToken(storage, nintendoAccountToken, proxy_url, allow_fetch_token);
        const {nooklink, data: webserviceToken} = wst;

        if (ratelimit) {
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(nintendoAccountToken);
            await checkUseLimit(storage, 'nooklink-user', jwt.payload.sub);
        }

        console.warn('Authenticating to NookLink as user %s', user);
        debug('Authenticating to NookLink as user %s', user);

        const token = await nooklink.getAuthToken(user);

        const existingToken: SavedUserToken = {
            token,
            user,
            webserviceToken,
        };

        await storage.setItem('NookAuthToken.' + nintendoAccountToken + '.' + user, existingToken);

        return {
            nooklinkuser: new NooklinkUserApi(user, token.token, nooklink.gtoken, nooklink.useragent),
            data: existingToken,
        };
    }

    debug('Using existing NookLink auth token');

    return {
        nooklinkuser: new NooklinkUserApi(
            user, existingToken.token.token,
            existingToken.webserviceToken.gtoken, existingToken.webserviceToken.useragent
        ),
        data: existingToken,
    };
}
