import process from 'node:process';
import * as fs from 'node:fs';
import { setTimeout } from 'node:timers';
import persist from 'node-persist';
import { getToken, Login } from './coral.js';
import SplatNet2Api, { SPLATNET2_WEBSERVICE_ID, SplatNet2AuthData, updateIksmSessionLastUsed } from '../../api/splatnet2.js';
import { checkMembershipActive, checkUseLimit, SHOULD_LIMIT_USE } from './util.js';
import createDebug from '../../util/debug.js';
import { Jwt } from '../../util/jwt.js';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';

const debug = createDebug('nxapi:auth:splatnet2');

export interface SavedIksmSessionToken extends SplatNet2AuthData {
    last_used?: number;
}

export async function getIksmToken(
    storage: persist.LocalStorage, token: string, proxy_url?: string,
    allow_fetch_token = false, ratelimit = SHOULD_LIMIT_USE
) {
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

        const webservice = webservices!.find(w => w.id === SPLATNET2_WEBSERVICE_ID);
        if (!webservice) throw new Error('Invalid web service');

        const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');
        if (verifymembership?.attrValue === 'true') checkMembershipActive(data);

        let attempt;
        if (ratelimit) {
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);
            attempt = await checkUseLimit(storage, 'splatnet2', jwt.payload.sub);
        }

        try {
            console.warn('Authenticating to SplatNet 2');
            debug('Authenticating to SplatNet 2');

            const existingToken: SavedIksmSessionToken = await SplatNet2Api.loginWithCoral(nso, data.user);

            await storage.setItem('IksmToken.' + token, existingToken);

            if (!iksm_sessions.has(existingToken.iksm_session)) {
                iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
            }

            return {
                splatnet: SplatNet2Api.createWithSavedToken(existingToken),
                data: existingToken,
            };
        } catch (err) {
            await attempt?.recordError(err);

            throw err;
        }
    }

    debug('Using existing token');

    if (!iksm_sessions.has(existingToken.iksm_session)) {
        iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
    }

    return {
        splatnet: SplatNet2Api.createWithSavedToken(existingToken),
        data: existingToken,
    };
}

export async function renewIksmToken(splatnet: SplatNet2Api, storage: persist.LocalStorage, token: string, proxy_url?: string) {
    console.warn('Authenticating to SplatNet 2');
    debug('Authenticating to SplatNet 2');

    const {nso, data} = await getToken(storage, token, proxy_url);

    const existingToken: SavedIksmSessionToken = await SplatNet2Api.loginWithCoral(nso, data.user);

    await storage.setItem('IksmToken.' + token, existingToken);

    if (!iksm_sessions.has(existingToken.iksm_session)) {
        iksm_sessions.set(existingToken.iksm_session, [storage, token, null, null]);
    }

    iksm_sessions.delete(splatnet.iksm_session);

    splatnet.iksm_session = existingToken.iksm_session;
    splatnet.useragent = existingToken.useragent;
}

const iksm_sessions = new Map<string, [persist.LocalStorage, string, number | null, NodeJS.Timeout | null]>();

updateIksmSessionLastUsed.handler = (iksm_session: string, last_used: number = Date.now()) => {
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
};

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
