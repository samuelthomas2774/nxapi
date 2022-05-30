import fetch, { Response } from 'node-fetch';
import { v4 as uuidgen } from 'uuid';
import createDebug from 'debug';
import { f, FlapgIid } from './f.js';
import { AccountLogin, AccountToken, Announcements, CurrentUser, CurrentUserPermissions, Event, Friends, GetActiveEventResult, PresencePermissions, User, WebServices, WebServiceToken, ZncErrorResponse, ZncResponse, ZncStatus, ZncSuccessResponse } from './znc-types.js';
import { getNintendoAccountToken, getNintendoAccountUser, NintendoAccountUser } from './na.js';
import { ErrorResponse } from './util.js';
import { JwtPayload } from '../util/jwt.js';

const debug = createDebug('nxapi:api:znc');

const ZNCA_PLATFORM = 'Android';
const ZNCA_PLATFORM_VERSION = '8.0.0';
const ZNCA_VERSION = '2.1.1';
const ZNCA_USER_AGENT = `com.nintendo.znca/${ZNCA_VERSION}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

const ZNC_URL = 'https://api-lp1.znc.srv.nintendo.net';
export const ZNCA_CLIENT_ID = '71b963c1b7b6d119';

export default class ZncApi {
    static useragent: string | null = null;

    onTokenExpired: ((data: ZncErrorResponse, res: Response) => Promise<void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;

    constructor(
        public token: string,
        public useragent: string | null = ZncApi.useragent
    ) {}

    async fetch<T = unknown>(
        url: string, method = 'GET', body?: string, headers?: object,
        /** @internal */ _autoRenewToken = true,
        /** @internal */ _attempt = 0
    ): Promise<ZncSuccessResponse<T>> {
        if (this._renewToken && _autoRenewToken) {
            await this._renewToken;
        }

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

        if (data.status === ZncStatus.TOKEN_EXPIRED && _autoRenewToken && !_attempt && this.onTokenExpired) {
            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, data, response).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _autoRenewToken, _attempt + 1);
        }

        if ('errorMessage' in data) {
            throw new ErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== ZncStatus.OK) {
            throw new ErrorResponse('[znc] Unknown error', response, data);
        }

        return data;
    }

    async call<T = unknown>(
        url: string, parameter = {},
        /** @internal */ _autoRenewToken = true
    ) {
        const uuid = uuidgen();

        return this.fetch<T>(url, 'POST', JSON.stringify({
            parameter,
            requestId: uuid,
        }), {}, _autoRenewToken);
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
        const data = await f(this.token, timestamp, uuid, FlapgIid.APP, useragent);

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
        const fdata = await f(id_token, timestamp, uuid, FlapgIid.NSO, useragent);

        const req = {
            naBirthday: user.birthday,
            timestamp,
            f: fdata.f,
            requestId: uuid,
            naIdToken: id_token,
        };

        const data = await this.call<AccountToken>('/v3/Account/GetToken', req, false);

        return {
            uuid,
            timestamp,
            nintendoAccountToken,
            // user,
            f: fdata,
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
        const fdata = await f(id_token, timestamp, uuid, FlapgIid.NSO, useragent ?? undefined);

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
                    f: fdata.f,
                },
            }),
        });

        debug('fetch %s %s, response %s', 'POST', '/v3/Account/Login', response.status);
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
            f: fdata,
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
