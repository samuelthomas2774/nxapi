import fetch from 'node-fetch';
import { v4 as uuidgen } from 'uuid';
import createDebug from 'debug';
import { flapg, FlapgIid, genfc } from './f.js';
import { AccountLogin, AccountToken, Announcements, CurrentUser, CurrentUserPermissions, Event, Friends, GetActiveEventResult, PresencePermissions, User, WebServices, WebServiceToken, ZncResponse, ZncStatus } from './znc-types.js';
import { getNintendoAccountToken, getNintendoAccountUser, NintendoAccountUser } from './na.js';
import { ErrorResponse } from './util.js';
import { JwtPayload } from '../util.js';

const debug = createDebug('api:znc');

const ZNCA_PLATFORM = 'Android';
const ZNCA_PLATFORM_VERSION = '8.0.0';
const ZNCA_VERSION = '2.1.0';
const ZNCA_USER_AGENT = `com.nintendo.znca/${ZNCA_VERSION}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

const ZNC_URL = 'https://api-lp1.znc.srv.nintendo.net';
export const ZNCA_CLIENT_ID = '71b963c1b7b6d119';

export default class ZncApi {
    static useragent: string | null = null;

    constructor(
        public token: string,
        public useragent: string | null = ZncApi.useragent
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
        if (data.status !== ZncStatus.OK) {
            throw new ErrorResponse('[znc] Unknown error', response, data);
        }

        return data;
    }

    async call<T = unknown>(url: string, parameter = {}) {
        const uuid = uuidgen();

        return this.fetch<T>(url, 'POST', JSON.stringify({
            parameter,
            requestId: uuid,
        }));
    }

    async getAnnouncements() {
        return this.call<Announcements>('/v1/Announcement/List');
    }

    async getFriendList() {
        return this.call<Friends>('/v3/Friend/List');
    }

    async addFavouriteFriend(nsaid: string) {
        return this.call<{}>('/v3/Friend/Favorite/Create', {
            nsaId: nsaid,
        });
    }

    async removeFavouriteFriend(nsaid: string) {
        return this.call<{}>('/v3/Friend/Favorite/Delete', {
            nsaId: nsaid,
        });
    }

    async getWebServices() {
        return this.call<WebServices>('/v1/Game/ListWebServices');
    }

    async getActiveEvent() {
        return this.call<GetActiveEventResult>('/v1/Event/GetActiveEvent');
    }

    async getEvent(id: number) {
        return this.call<Event>('/v1/Event/Show', {
            id,
        });
    }

    async getUser(id: number) {
        return this.call<User>('/v3/User/Show', {
            id,
        });
    }

    async getCurrentUser() {
        return this.call<CurrentUser>('/v3/User/ShowSelf');
    }

    async getCurrentUserPermissions() {
        return this.call<CurrentUserPermissions>('/v3/User/Permissions/ShowSelf');
    }

    async updateCurrentUserPermissions(to: PresencePermissions, from: PresencePermissions, etag: string) {
        return this.call<{}>('/v3/User/Permissions/UpdateSelf', {
            permissions: {
                presence: {
                    toValue: to,
                    fromValue: from,
                },
            },
            etag,
        });
    }

    async getWebServiceToken(id: string) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        const useragent = this.useragent ?? undefined;
        const data = process.env.ZNCA_API_URL ?
            await genfc(process.env.ZNCA_API_URL + '/f', this.token, timestamp, uuid, FlapgIid.APP, useragent) :
            await flapg(this.token, timestamp, uuid, FlapgIid.APP, useragent);

        const req = {
            id,
            registrationToken: this.token,
            f: data.f,
            requestId: uuid,
            timestamp,
        };

        return this.call<WebServiceToken>('/v2/Game/GetWebServiceToken', req);
    }

    async getToken(token: string, user: NintendoAccountUser) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        const id_token = nintendoAccountToken.id_token;
        const useragent = this.useragent ?? undefined;
        const flapgdata = process.env.ZNCA_API_URL ?
            await genfc(process.env.ZNCA_API_URL + '/f', id_token, timestamp, uuid, FlapgIid.NSO, useragent) :
            await flapg(id_token, timestamp, uuid, FlapgIid.NSO, useragent);

        const req = {
            naBirthday: user.birthday,
            timestamp,
            f: flapgdata.f,
            requestId: uuid,
            naIdToken: id_token,
        };

        const data = await this.call<AccountToken>('/v3/Account/GetToken', req);

        return {
            uuid,
            timestamp,
            nintendoAccountToken,
            // user,
            flapg: flapgdata,
            nsoAccount: data.result,
            credential: data.result.webApiServerCredential,
        };
    }

    static async createWithSessionToken(token: string, useragent = ZncApi.useragent) {
        const data = await this.loginWithSessionToken(token, useragent);

        return {
            nso: new this(data.credential.accessToken, useragent),
            data,
        };
    }

    async renewToken(token: string, user: NintendoAccountUser) {
        const data = await this.getToken(token, user);

        this.token = data.credential.accessToken;

        return data;
    }

    static async loginWithSessionToken(token: string, useragent = ZncApi.useragent) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser(nintendoAccountToken);

        const id_token = nintendoAccountToken.id_token;
        const flapgdata = process.env.ZNCA_API_URL ?
            await genfc(process.env.ZNCA_API_URL + '/f', id_token, timestamp, uuid, FlapgIid.NSO, useragent ?? undefined) :
            await flapg(id_token, timestamp, uuid, FlapgIid.NSO, useragent ?? undefined);

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
