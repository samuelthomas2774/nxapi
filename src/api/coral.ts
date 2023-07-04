import fetch, { Response } from 'node-fetch';
import { v4 as uuidgen } from 'uuid';
import createDebug from '../util/debug.js';
import { JwtPayload } from '../util/jwt.js';
import { timeoutSignal } from '../util/misc.js';
import { getAdditionalUserAgents } from '../util/useragent.js';
import type { CoralRemoteConfig } from '../common/remote-config.js';
import { AccountLogin, AccountLoginParameter, AccountToken, AccountTokenParameter, Announcements, CoralError, CoralResponse, CoralStatus, CoralSuccessResponse, CurrentUser, CurrentUserPermissions, Event, FriendCodeUrl, FriendCodeUser, Friends, GetActiveEventResult, PresencePermissions, User, WebServices, WebServiceToken, WebServiceTokenParameter } from './coral-types.js';
import { f, FResult, HashMethod } from './f.js';
import { generateAuthData, getNintendoAccountToken, getNintendoAccountUser, NintendoAccountSessionAuthorisation, NintendoAccountToken, NintendoAccountUser } from './na.js';
import { ErrorResponse, ResponseSymbol } from './util.js';
import { ErrorDescription, ErrorDescriptionSymbol, HasErrorDescription } from '../util/errors.js';

const debug = createDebug('nxapi:api:coral');

const ZNCA_PLATFORM = 'Android';
const ZNCA_PLATFORM_VERSION = '8.0.0';
const ZNCA_VERSION = '2.2.0';
const ZNCA_USER_AGENT = `com.nintendo.znca/${ZNCA_VERSION}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

const ZNC_URL = 'https://api-lp1.znc.srv.nintendo.net';
export const ZNCA_CLIENT_ID = '71b963c1b7b6d119';

const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;
const FRIEND_CODE_HASH = /^[A-Za-z0-9]{10}$/;

export const ResponseDataSymbol = Symbol('ResponseData');
export const CorrelationIdSymbol = Symbol('CorrelationId');

export type Result<T> = T & ResultData<T>;

export interface ResultData<T> {
    [ResponseSymbol]: Response;
    [ResponseDataSymbol]: CoralSuccessResponse<T>;
    [CorrelationIdSymbol]: string;

    /** @deprecated */
    status: CoralStatus.OK;
    /** @deprecated */
    result: T;
    /** @deprecated */
    correlationId: string;
}

export interface CoralApiInterface {
    getAnnouncements(): Promise<Result<Announcements>>;
    getFriendList(): Promise<Result<Friends>>;
    addFavouriteFriend(nsa_id: string): Promise<Result<{}>>;
    removeFavouriteFriend(nsa_id: string): Promise<Result<{}>>;
    getWebServices(): Promise<Result<WebServices>>;
    getActiveEvent(): Promise<Result<GetActiveEventResult>>;
    getEvent(id: number): Promise<Result<Event>>;
    getUser(id: number): Promise<Result<User>>;
    getUserByFriendCode(friend_code: string, hash?: string): Promise<Result<FriendCodeUser>>;
    getCurrentUser(): Promise<Result<CurrentUser>>;
    getFriendCodeUrl(): Promise<Result<FriendCodeUrl>>;
    getCurrentUserPermissions(): Promise<Result<CurrentUserPermissions>>;
    getWebServiceToken(id: number): Promise<Result<WebServiceToken>>;
}

export interface ClientInfo {
    platform: string;
    version: string;
    useragent: string;
}

const RemoteConfigSymbol = Symbol('RemoteConfigSymbol');
const ClientInfoSymbol = Symbol('CoralClientInfo');
const CoralUserIdSymbol = Symbol('CoralUserId');
const NintendoAccountIdSymbol = Symbol('NintendoAccountId');

export default class CoralApi implements CoralApiInterface {
    [RemoteConfigSymbol]!: CoralRemoteConfig | null;
    [ClientInfoSymbol]: ClientInfo;
    [CoralUserIdSymbol]: string;
    [NintendoAccountIdSymbol]: string;

    onTokenExpired: ((data?: CoralError, res?: Response) => Promise<CoralAuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;
    /** @internal */
    _token_expired = false;

    protected constructor(
        public token: string,
        public useragent: string | null = getAdditionalUserAgents(),
        coral_user_id: string,
        na_id: string,
        znca_version = ZNCA_VERSION,
        znca_useragent = ZNCA_USER_AGENT,
        config?: CoralRemoteConfig,
    ) {
        this[ClientInfoSymbol] = {platform: ZNCA_PLATFORM, version: znca_version, useragent: znca_useragent};
        this[CoralUserIdSymbol] = coral_user_id;
        this[NintendoAccountIdSymbol] = na_id;

        Object.defineProperty(this, RemoteConfigSymbol, {enumerable: false, value: config ?? null});
        Object.defineProperty(this, 'token', {enumerable: false, value: this.token});
        Object.defineProperty(this, '_renewToken', {enumerable: false, value: this._renewToken});
        Object.defineProperty(this, '_token_expired', {enumerable: false, value: this._token_expired});
    }

    /** @internal */
    get znca_version() {
        return this[ClientInfoSymbol].version;
    }
    /** @internal */
    get znca_useragent() {
        return this[ClientInfoSymbol].useragent;
    }

    async fetch<T = unknown>(
        url: string, method = 'GET', body?: string, headers?: object,
        /** @internal */ _autoRenewToken = true,
        /** @internal */ _attempt = 0,
    ): Promise<Result<T>> {
        if (this._token_expired && _autoRenewToken && !this._renewToken) {
            if (!this.onTokenExpired || _attempt) throw new Error('Token expired');

            this._renewToken = this.onTokenExpired.call(null).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
        }

        if (this._renewToken && _autoRenewToken) {
            await this._renewToken;
        }

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(ZNC_URL + url, {
            method,
            headers: Object.assign({
                'X-Platform': this[ClientInfoSymbol].platform,
                'X-ProductVersion': this[ClientInfoSymbol].version,
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': this[ClientInfoSymbol].useragent,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status !== 200) {
            throw new CoralErrorResponse('[znc] Non-200 status code', response, await response.text());
        }

        const data = await response.json() as CoralResponse<T>;

        if (data.status === CoralStatus.TOKEN_EXPIRED && _autoRenewToken && !_attempt && this.onTokenExpired) {
            this._token_expired = true;
            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, data, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _autoRenewToken, _attempt + 1);
        }

        if ('errorMessage' in data) {
            throw new CoralErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== CoralStatus.OK) {
            throw new CoralErrorResponse('[znc] Unknown error', response, data);
        }

        const result = data.result;

        Object.defineProperty(result, ResponseSymbol, {enumerable: false, value: response});
        Object.defineProperty(result, ResponseDataSymbol, {enumerable: false, value: data});
        Object.defineProperty(result, CorrelationIdSymbol, {enumerable: false, value: data.correlationId});

        Object.defineProperty(result, 'status', {enumerable: false, value: CoralStatus.OK});
        Object.defineProperty(result, 'result', {enumerable: false, value: data.result});
        Object.defineProperty(result, 'correlationId', {enumerable: false, value: data.correlationId});

        return result as Result<T>;
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

    async addFavouriteFriend(nsa_id: string) {
        return this.call<{}>('/v3/Friend/Favorite/Create', {
            nsaId: nsa_id,
        });
    }

    async removeFavouriteFriend(nsa_id: string) {
        return this.call<{}>('/v3/Friend/Favorite/Delete', {
            nsaId: nsa_id,
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

    async getUserByFriendCode(friend_code: string, hash?: string) {
        if (!FRIEND_CODE.test(friend_code)) throw new Error('Invalid friend code');
        if (hash && !FRIEND_CODE_HASH.test(hash)) throw new Error('Invalid friend code hash');

        return hash ? this.call<FriendCodeUser>('/v3/Friend/GetUserByFriendCodeHash', {
            friendCode: friend_code,
            friendCodeHash: hash,
        }) : this.call<FriendCodeUser>('/v3/Friend/GetUserByFriendCode', {
            friendCode: friend_code,
        });
    }

    async sendFriendRequest(nsa_id: string) {
        return this.call<{}>('/v3/FriendRequest/Create', {
            nsaId: nsa_id,
        });
    }

    async getCurrentUser() {
        return this.call<CurrentUser>('/v3/User/ShowSelf');
    }

    async getFriendCodeUrl() {
        return this.call<FriendCodeUrl>('/v3/Friend/CreateFriendCodeUrl');
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

    async getWebServiceToken(id: number, /** @internal */ _attempt = 0): Promise<Result<WebServiceToken>> {
        await this._renewToken;

        const data = await f(this.token, HashMethod.WEB_SERVICE, {
            platform: this[ClientInfoSymbol].platform,
            version: this[ClientInfoSymbol].version,
            useragent: this.useragent ?? getAdditionalUserAgents(),
            user: {na_id: this[NintendoAccountIdSymbol], coral_user_id: this[CoralUserIdSymbol]},
        });

        const req: WebServiceTokenParameter = {
            id,
            registrationToken: '',
            f: data.f,
            requestId: data.request_id,
            timestamp: data.timestamp,
        };

        try {
            return await this.call<WebServiceToken>('/v2/Game/GetWebServiceToken', req, false);
        } catch (err) {
            if (err instanceof CoralErrorResponse && err.status === CoralStatus.TOKEN_EXPIRED && !_attempt && this.onTokenExpired) {
                debug('Error getting web service token, renewing token before retrying', err);
                // _renewToken will be awaited when calling getWebServiceToken
                this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, err.data, err.response as Response).then(data => {
                    if (data) this.setTokenWithSavedToken(data);
                }).finally(() => {
                    this._renewToken = null;
                });
                return this.getWebServiceToken(id, _attempt + 1);
            } else {
                throw err;
            }
        }
    }

    async getToken(token: string, user: NintendoAccountUser): Promise<PartialCoralAuthData> {
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        return this.getTokenWithNintendoAccountToken(nintendoAccountToken, user);
    }

    async getTokenWithNintendoAccountToken(
        nintendoAccountToken: NintendoAccountToken, user: NintendoAccountUser,
    ): Promise<PartialCoralAuthData> {
        const fdata = await f(nintendoAccountToken.id_token, HashMethod.CORAL, {
            platform: this[ClientInfoSymbol].platform,
            version: this[ClientInfoSymbol].version,
            useragent: this.useragent ?? getAdditionalUserAgents(),
            user: {na_id: user.id, coral_user_id: this[CoralUserIdSymbol]},
        });

        const req: AccountTokenParameter = {
            naBirthday: user.birthday,
            timestamp: fdata.timestamp,
            f: fdata.f,
            requestId: fdata.request_id,
            naIdToken: nintendoAccountToken.id_token,
        };

        const data = await this.call<AccountToken>('/v3/Account/GetToken', req, false);

        return {
            nintendoAccountToken,
            // user,
            f: fdata,
            nsoAccount: data,
            credential: data.webApiServerCredential,
        };
    }

    async renewToken(token: string, user: NintendoAccountUser) {
        const data = await this.getToken(token, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    async renewTokenWithNintendoAccountToken(token: NintendoAccountToken, user: NintendoAccountUser) {
        const data = await this.getTokenWithNintendoAccountToken(token, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    protected setTokenWithSavedToken(data: CoralAuthData | PartialCoralAuthData) {
        this.token = data.credential.accessToken;
        this[CoralUserIdSymbol] = '' + data.nsoAccount.user.id;
        if ('user' in data) this[NintendoAccountIdSymbol] = data.user.id;
        this._token_expired = false;
    }

    static async createWithSessionToken(token: string, useragent = getAdditionalUserAgents()) {
        const data = await this.loginWithSessionToken(token, useragent);
        return {nso: this.createWithSavedToken(data, useragent), data};
    }

    static async createWithNintendoAccountToken(
        token: NintendoAccountToken, user: NintendoAccountUser,
        useragent = getAdditionalUserAgents()
    ) {
        const data = await this.loginWithNintendoAccountToken(token, user, useragent);
        return {nso: this.createWithSavedToken(data, useragent), data};
    }

    static createWithSavedToken(data: CoralAuthData, useragent = getAdditionalUserAgents()) {
        return new this(
            data.credential.accessToken,
            useragent,
            '' + data.nsoAccount.user.id,
            data.user.id,
            data.znca_version,
            data.znca_useragent,
        );
    }

    static async loginWithSessionToken(token: string, useragent = getAdditionalUserAgents()): Promise<CoralAuthData> {
        const { default: { coral: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents Coral authentication');

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser(nintendoAccountToken);

        return this.loginWithNintendoAccountToken(nintendoAccountToken, user, useragent);
    }

    static async loginWithNintendoAccountToken(
        nintendoAccountToken: NintendoAccountToken,
        user: NintendoAccountUser,
        useragent = getAdditionalUserAgents(),
    ) {
        const { default: { coral: config } } = await import('../common/remote-config.js');

        if (!config) throw new Error('Remote configuration prevents Coral authentication');
        const znca_useragent = `com.nintendo.znca/${config.znca_version}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

        const fdata = await f(nintendoAccountToken.id_token, HashMethod.CORAL, {
            platform: ZNCA_PLATFORM,
            version: config.znca_version,
            useragent,
            user: {na_id: user.id},
        });

        debug('Getting Nintendo Switch Online app token');

        const parameter: AccountLoginParameter = {
            naIdToken: nintendoAccountToken.id_token,
            naBirthday: user.birthday,
            naCountry: user.country,
            language: user.language,
            timestamp: fdata.timestamp,
            requestId: fdata.request_id,
            f: fdata.f,
        };

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(ZNC_URL + '/v3/Account/Login', {
            method: 'POST',
            headers: {
                'X-Platform': ZNCA_PLATFORM,
                'X-ProductVersion': config.znca_version,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': znca_useragent,
            },
            body: JSON.stringify({
                parameter,
            }),
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', 'POST', '/v3/Account/Login', response.status);

        if (response.status !== 200) {
            throw new CoralErrorResponse('[znc] Non-200 status code', response, await response.text());
        }

        const data = await response.json() as CoralResponse<AccountLogin>;

        if ('errorMessage' in data) {
            throw new CoralErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== CoralStatus.OK) {
            throw new CoralErrorResponse('[znc] Unknown error', response, data);
        }

        debug('Got Nintendo Switch Online app token', data);

        return {
            nintendoAccountToken,
            user,
            f: fdata,
            nsoAccount: data.result,
            credential: data.result.webApiServerCredential,
            znca_version: config.znca_version,
            znca_useragent,
        };
    }
}

export class CoralErrorResponse extends ErrorResponse<CoralError> implements HasErrorDescription {
    get status(): CoralStatus | null {
        return this.data?.status ?? null;
    }

    get [ErrorDescriptionSymbol]() {
        if (this.status === CoralStatus.NSA_NOT_LINKED) {
            return new ErrorDescription('coral.nsa_not_linked', 'Your Nintendo Account is not linked to a Network Service Account (Nintendo Switch user).\n\nMake sure you are using the Nintendo Account linked to your Nintendo Switch console.');
        }
        if (this.status === CoralStatus.UPGRADE_REQUIRED) {
            return new ErrorDescription('coral.upgrade_required', 'The Coral (Nintendo Switch Online app) version used by nxapi is no longer supported by the Coral API.\n\nTry restarting nxapi and make sure nxapi is up to date.');
        }

        return null;
    }
}

const na_client_settings = {
    client_id: ZNCA_CLIENT_ID,
    scope: 'openid user user.birthday user.mii user.screenName',
};

export class NintendoAccountSessionAuthorisationCoral extends NintendoAccountSessionAuthorisation {
    protected constructor(
        authorise_url: string,
        state: string,
        verifier: string,
        redirect_uri?: string,
    ) {
        const { client_id, scope } = na_client_settings;

        super(client_id, scope, authorise_url, state, verifier, redirect_uri);
    }

    static create(/** @internal */ redirect_uri?: string) {
        const { client_id, scope } = na_client_settings;
        const auth_data = generateAuthData(client_id, scope, redirect_uri);

        return new this(auth_data.url, auth_data.state, auth_data.verifier, redirect_uri);
    }
}

export interface CoralAuthData {
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;
    f: FResult;
    nsoAccount: AccountLogin;
    credential: AccountLogin['webApiServerCredential'];
    znca_version: string;
    znca_useragent: string;
}

export type PartialCoralAuthData =
    Pick<CoralAuthData, 'nintendoAccountToken' | 'f' | 'nsoAccount' | 'credential'>;

export interface CoralJwtPayload extends JwtPayload {
    isChildRestricted: boolean;
    membership: {
        active: boolean;
    };
    aud: string;
    exp: number;
    iat: number;
    iss: 'api-lp1.znc.srv.nintendo.net';
    /** Coral user ID (CurrentUser.id, not CurrentUser.nsaId) */
    sub: number;
    typ: 'id_token';
}
export interface CoralWebServiceJwtPayload extends JwtPayload {
    isChildRestricted: boolean;
    aud: string;
    exp: number;
    iat: number;
    iss: 'api-lp1.znc.srv.nintendo.net';
    jti: string;
    /** Coral user ID (CurrentUser.id, not CurrentUser.nsaId) */
    sub: number;
    links: {
        networkServiceAccount: {
            /** NSA ID (CurrentUser.nsaId) */
            id: string;
        };
    };
    typ: 'id_token';
    membership: {
        active: boolean;
    };
}
