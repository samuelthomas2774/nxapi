import createDebug from 'debug';
import persist from 'node-persist';
import { getToken } from '../../util.js';
import SplatNet2Api, { SavedIksmSessionToken } from '../../api/splatnet2.js';

const debug = createDebug('cli:splatnet2');

export async function getIksmToken(storage: persist.LocalStorage, token: string, proxy_url?: string, allow_fetch_token = false) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedIksmSessionToken | undefined = await storage.getItem('IksmToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        if (!allow_fetch_token) {
            throw new Error('No valid iksm_session cookie');
        }

        console.warn('Authenticating to SplatNet 2');
        debug('Authenticating to SplatNet 2');

        const {nso, data} = await getToken(storage, token, proxy_url);

        const existingToken = await SplatNet2Api.loginWithZnc(nso, data.user);

        await storage.setItem('IksmToken.' + token, existingToken);

        return {
            splatnet: new SplatNet2Api(existingToken.iksm_session, existingToken.useragent),
            data: existingToken,
        };
    }

    debug('Using existing token');

    return {
        splatnet: new SplatNet2Api(existingToken.iksm_session, existingToken.useragent),
        data: existingToken,
    };
}
