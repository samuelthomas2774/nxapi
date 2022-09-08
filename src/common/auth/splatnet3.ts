import createDebug from 'debug';
import persist from 'node-persist';
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

        return {
            splatnet: SplatNet3Api.createWithSavedToken(existingToken),
            data: existingToken,
        };
    }

    debug('Using existing token');

    return {
        splatnet: SplatNet3Api.createWithSavedToken(existingToken),
        data: existingToken,
    };
}
