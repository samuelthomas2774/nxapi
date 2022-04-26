import createDebug from 'debug';
import persist from 'node-persist';
import * as fs from 'fs';
import { getToken } from '../../util.js';
import SplatNet2Api from '../../api/splatnet2.js';
import { WebServiceToken } from '../../api/znc-types.js';

const debug = createDebug('cli:splatnet2');

export interface SavedIksmSessionToken {
    webserviceToken: WebServiceToken;
    url: string;
    cookies: string;

    iksm_session: string;
    expires_at: number;
    useragent: string;

    last_used?: number;
}

export async function getIksmToken(storage: persist.LocalStorage, token: string, proxy_url?: string, allow_fetch_token = false) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedIksmSessionToken | undefined = await storage.getItem('IksmToken.' + token);

    const td = 24 * 60 * 60 * 1000; // 1 day in ms
    const last_used_days_ago = existingToken?.last_used && (existingToken.last_used + td) <= Date.now();
    const expired = existingToken && existingToken.expires_at <= Date.now();

    if (!existingToken || ((!existingToken.last_used || last_used_days_ago) && expired)) {
        if (!allow_fetch_token) {
            throw new Error('No valid iksm_session cookie');
        }

        console.warn('Authenticating to SplatNet 2');
        debug('Authenticating to SplatNet 2');

        const {nso, data} = await getToken(storage, token, proxy_url);

        const existingToken: SavedIksmSessionToken = await SplatNet2Api.loginWithZnc(nso, data.user);

        await storage.setItem('IksmToken.' + token, existingToken);

        if (!iksm_sessions.has(existingToken.iksm_session)) {
            iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
        }

        return {
            splatnet: new SplatNet2Api(existingToken.iksm_session, existingToken.useragent),
            data: existingToken,
        };
    }

    debug('Using existing token');

    if (!iksm_sessions.has(existingToken.iksm_session)) {
        iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
    }

    return {
        splatnet: new SplatNet2Api(existingToken.iksm_session, existingToken.useragent),
        data: existingToken,
    };
}

export async function renewIksmToken(splatnet: SplatNet2Api, storage: persist.LocalStorage, token: string, proxy_url?: string) {
    console.warn('Authenticating to SplatNet 2');
    debug('Authenticating to SplatNet 2');

    const {nso, data} = await getToken(storage, token, proxy_url);

    const existingToken: SavedIksmSessionToken = await SplatNet2Api.loginWithZnc(nso, data.user);

    await storage.setItem('IksmToken.' + token, existingToken);

    if (!iksm_sessions.has(existingToken.iksm_session)) {
        iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
    }

    iksm_sessions.delete(splatnet.iksm_session);

    splatnet.iksm_session = existingToken.iksm_session;
    splatnet.useragent = existingToken.useragent;
}

const iksm_sessions = new Map<string, [persist.LocalStorage, string, number | null, NodeJS.Timeout | null]>();

export function updateIksmSessionLastUsed(iksm_session: string, last_used: number = Date.now()) {
    const match = iksm_sessions.get(iksm_session);
    if (!match) return;

    const [storage, token,, timeout] = match;

    const new_timeout = timeout ?? setTimeout(() => {
        const match = iksm_sessions.get(iksm_session);
        if (!match) return;

        const [storage, token, last_used, timeout] = match;
        if (timeout === new_timeout) match[3] = null;

        writeUpdatedIksmSessionLastUsed(storage, token, last_used!);
        match[2] = null;
    }, 1000);

    iksm_sessions.set(iksm_session, [storage, token, last_used, new_timeout]);
}

function writeUpdatedIksmSessionLastUsed(storage: persist.LocalStorage, token: string, last_used: number) {
    const datum_str = fs.readFileSync(storage.getDatumPath('IksmToken.' + token), 'utf-8');
    const datum: persist.Datum = storage.parse(datum_str);
    const data: SavedIksmSessionToken = datum.value;

    if (data.last_used && data.last_used >= last_used) return;

    data.last_used = last_used;

    const new_datum_str = storage.stringify(datum);
    fs.writeFileSync(storage.getDatumPath('IksmToken.' + token), new_datum_str, 'utf-8');
}

function writeUpdatedIksmSessionsLastUsed() {
    for (const [iksm_session, data] of iksm_sessions) {
        const [storage, token, last_used, timeout] = data;
        if (timeout) clearTimeout(timeout), data[3] = null;
        if (!last_used) continue;

        writeUpdatedIksmSessionLastUsed(storage, token, last_used);
        data[2] = null;
    }
}

process.on('exit', () => writeUpdatedIksmSessionsLastUsed());
process.on('uncaughtExceptionMonitor', () => writeUpdatedIksmSessionsLastUsed());
