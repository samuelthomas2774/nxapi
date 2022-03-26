import fetch from 'node-fetch';
import { v4 as uuidgen } from 'uuid';
import createDebug from 'debug';
import { flapg, FlapgIid, genfc } from './f.js';
import { AccountLogin, ActiveEvent, Announcement, CurrentUser, Friends, WebService, WebServiceToken, ZncResponse } from './znc-types.js';
import { getNintendoAccountToken, getNintendoAccountUser } from './na.js';
import { ErrorResponse, JwtPayload } from './util.js';

const debug = createDebug('api:znc');

const ZNCA_PLATFORM = 'Android';
const ZNCA_PLATFORM_VERSION = '8.0.0';
const ZNCA_VERSION = '2.0.0';
const ZNCA_USER_AGENT = `com.nintendo.znca/${ZNCA_VERSION}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

const ZNC_URL = 'https://api-lp1.znc.srv.nintendo.net';
export const ZNCA_CLIENT_ID = '71b963c1b7b6d119';

export default class ZncApi {
    constructor(
        public token: string
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const response = await fetch(ZNC_URL + url, {
            method: method,
            headers: Object.assign({
                'X-Platform': ZNCA_PLATFORM,
                'X-ProductVersion': ZNCA_VERSION,
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': ZNCA_USER_AGENT,
            }, headers),
            body: body,
        });

        debug('fetch %s %s, response %s', method, url, response.status);

        const data = await response.json() as ZncResponse<T>;

        if ('errorMessage' in data) {
            throw new ErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== 0) {
            throw new ErrorResponse('[znc] Unknown error', response, data);
        }

        return data;
    }

    async getAnnouncements() {
        return this.fetch<Announcement[]>('/v1/Announcement/List', 'POST', '{"parameter":{}}');
    }

    async getFriendList() {
        return this.fetch<Friends>('/v3/Friend/List', 'POST', '{"parameter":{}}');
    }

    async getWebServices() {
        const uuid = uuidgen();

        return this.fetch<WebService[]>('/v1/Game/ListWebServices', 'POST', JSON.stringify({
            requestId: uuid,
        }));
    }

    async getActiveEvent() {
        return this.fetch<ActiveEvent>('/v1/Event/GetActiveEvent', 'POST', '{"parameter":{}}');
    }

    async getCurrentUser() {
        return this.fetch<CurrentUser>('/v3/User/ShowSelf', 'POST', '{"parameter":{}}');
    }

    async getWebServiceToken(id: string) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        const data = process.env.ZNCA_API_URL ?
            await genfc(process.env.ZNCA_API_URL + '/f', this.token, timestamp, uuid, FlapgIid.APP) :
            await flapg(this.token, timestamp, uuid, FlapgIid.APP);

        const req = {
            id,
            registrationToken: this.token,
            f: data.f,
            requestId: uuid,
            timestamp,
        };

        return this.fetch<WebServiceToken>('/v2/Game/GetWebServiceToken', 'POST', JSON.stringify({
            parameter: req,
        }));
    }

    static async createWithSessionToken(token: string) {
        const data = await this.loginWithSessionToken(token);

        return {
            nso: new this(data.credential.accessToken),
            data,
        };
    }

    async renewToken(token: string) {
        const data = await ZncApi.loginWithSessionToken(token);

        this.token = data.credential.accessToken;

        return data;
    }

    static async loginWithSessionToken(token: string) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser(nintendoAccountToken);

        const flapgdata = process.env.ZNCA_API_URL ?
            await genfc(process.env.ZNCA_API_URL + '/f', nintendoAccountToken.id_token, timestamp, uuid, FlapgIid.NSO) :
            await flapg(nintendoAccountToken.id_token, timestamp, uuid, FlapgIid.NSO);

        debug('Getting Nintendo Switch Online app token');

        const response = await fetch(ZNC_URL + '/v3/Account/Login', {
            method: 'POST',
            headers: {
                'X-Platform': ZNCA_PLATFORM,
                'X-ProductVersion': ZNCA_VERSION,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': ZNCA_USER_AGENT,
            },
            body: JSON.stringify({
                parameter: {
                    naIdToken: nintendoAccountToken.id_token,
                    naBirthday: user.birthday,
                    naCountry: user.country,
                    language: user.language,
                    timestamp,
                    requestId: uuid,
                    f: flapgdata.f,
                },
            }),
        });

        const data = await response.json() as ZncResponse<AccountLogin>;

        if ('errorMessage' in data) {
            throw new ErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== 0) {
            throw new ErrorResponse('[znc] Unknown error', response, data);
        }

        debug('Got Nintendo Switch Online app token', data);

        return {
            uuid,
            timestamp,
            nintendoAccountToken,
            user,
            flapg: flapgdata,
            nsoAccount: data.result,
            credential: data.result.webApiServerCredential,
        };
    }
}

export interface ZncJwtPayload extends JwtPayload {
    isChildRestricted: boolean;
    membership: {
        active: boolean;
    };
    aud: string;
    exp: number;
    iat: number;
    iss: 'api-lp1.znc.srv.nintendo.net';
    /** User ID (CurrentUser.id, not CurrentUser.nsaID) */
    sub: number;
    typ: 'id_token';
}
export interface ZncWebServiceJwtPayload extends JwtPayload {
    isChildRestricted: boolean;
    aud: string;
    exp: number;
    iat: number;
    iss: 'api-lp1.znc.srv.nintendo.net';
    jti: string;
    /** User ID (CurrentUser.id, not CurrentUser.nsaID) */
    sub: number;
    links: {
        networkServiceAccount: {
            /** NSA ID (CurrentUser.nsaID) */
            id: string;
        };
    };
    typ: 'id_token';
    membership: {
        active: boolean;
    };
}
