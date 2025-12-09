import { randomUUID } from 'node:crypto';
import { fetch, Response } from 'undici';
import createDebug from '../util/debug.js';
import { JwtPayload } from '../util/jwt.js';
import { timeoutSignal } from '../util/misc.js';
import { getAdditionalUserAgents } from '../util/useragent.js';
import type { CoralRemoteConfig } from '../common/remote-config.js';
import { AccountLogin, AccountLogin_4, AccountLoginParameter, AccountToken, AccountToken_4, AccountTokenParameter, Announcements_4, BlockingUsers, CoralError, CoralResponse, CoralStatus, CoralSuccessResponse, CreateFriendRequestChannel, CurrentUser, CurrentUserPermissions, Event, Friend_4, FriendCodeUrl, FriendCodeUser, FriendRouteChannel, Friends_4, GetActiveEventResult, ListChat, ListHashtag, ListHashtagParameter, ListMedia, ListPushNotificationSettings, Media, PlayLogPermissions, PresencePermissions, PushNotificationPlayInvitationScope, ReceivedFriendRequest, ReceivedFriendRequests, SentFriendRequests, ShowUserLogin, UpdatePushNotificationSettingsParameter, UpdatePushNotificationSettingsParameterItem, User, UserPlayLog, WebServices_4, WebServiceToken, WebServiceTokenParameter } from './coral-types.js';
import { createZncaApi, DecryptResponseResult, FResult, HashMethod, RequestEncryptionProvider, ZncaApi, ZncaApiNxapi } from './f.js';
import { generateAuthData, getNintendoAccountToken, getNintendoAccountUser, NintendoAccountScope, NintendoAccountSessionAuthorisation, NintendoAccountToken, NintendoAccountUser } from './na.js';
import { ErrorResponse, ResponseSymbol } from './util.js';
import { ErrorDescription, ErrorDescriptionSymbol, HasErrorDescription } from '../util/errors.js';

const debug = createDebug('nxapi:api:coral');

const ZNCA_PLATFORM = 'Android';
const ZNCA_PLATFORM_VERSION = '12';
export const ZNCA_VERSION = '3.2.0'; // TODO: update to 3.1.0
const ZNCA_USER_AGENT = `com.nintendo.znca/${ZNCA_VERSION}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

export const ZNCA_API_COMPATIBILITY_VERSION = 'hio87-mJks_e9GNF';

const ZNC_URL = 'https://api-lp1.znc.srv.nintendo.net';
export const ZNCA_CLIENT_ID = '71b963c1b7b6d119';

const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;
const FRIEND_CODE_HASH = /^[A-Za-z0-9]{10}$/;

export const ResponseEncryptionSymbol = Symbol('ResponseEncryption');
export const ResponseDataSymbol = Symbol('ResponseData');
export const CorrelationIdSymbol = Symbol('CorrelationId');

export type Result<T> = T & ResultData<T>;

export interface ResultData<T> {
    [ResponseSymbol]: Response;
    [ResponseEncryptionSymbol]: ResponseEncryption | null;
    [ResponseDataSymbol]: CoralSuccessResponse<T>;
    [CorrelationIdSymbol]: string;

    /** @deprecated */
    status: CoralStatus.OK;
    /** @deprecated */
    result: T;
    /** @deprecated */
    correlationId: string;
}
export interface ResponseEncryption {
    encrypted: Uint8Array;
    decrypt_result: DecryptResponseResult;
}

export interface CoralApiInterface {
    getAnnouncements(): Promise<Result<Announcements_4>>;
    getFriendList(): Promise<Result<Friends_4>>;
    addFavouriteFriend(nsa_id: string): Promise<Result<{}>>;
    removeFavouriteFriend(nsa_id: string): Promise<Result<{}>>;
    deleteFriendIsNew(nsa_id: string): Promise<Result<{}>>;
    getWebServices(): Promise<Result<WebServices_4>>;
    getChats(): Promise<Result<ListChat>>;
    getMedia(): Promise<Result<ListMedia>>;
    getActiveEvent(): Promise<Result<GetActiveEventResult>>;
    getEvent(id: number): Promise<Result<Event>>;
    getUser(id: number): Promise<Result<User>>;
    getUserByFriendCode(friend_code: string, hash?: string): Promise<Result<FriendCodeUser>>;
    getCurrentUser(): Promise<Result<CurrentUser>>;
    getReceivedFriendRequests(): Promise<Result<ReceivedFriendRequests>>;
    getSentFriendRequests(): Promise<Result<SentFriendRequests>>;
    getFriendCodeUrl(): Promise<Result<FriendCodeUrl>>;
    getCurrentUserPermissions(): Promise<Result<CurrentUserPermissions>>;
    updateFriendOnlineNotificationSettings(nsa_id: string, value: boolean): Promise<Result<{}>>;
    getWebServiceToken(id: number): Promise<Result<WebServiceToken>>;
}

export abstract class AbstractCoralApi {
    abstract call<T extends {}, R extends {} = {}>(
        url: string, parameter?: R & Partial<RequestFlags>,
    ): Promise<Result<T>>;

    async getAnnouncements() {
        return this.call<Announcements_4>('/v4/Announcement/List', {
            [RequestFlagAddPlatformSymbol]: true,
        });
    }

    async getWebServices() {
        return this.call<WebServices_4>('/v4/GameWebService/List', {
            [RequestFlagNoParameterSymbol]: true,
            [RequestFlagRequestIdSymbol]: RequestFlagRequestId.AFTER,
        });
    }

    async getChats() {
        return this.call<ListChat>('/v5/Chat/List');
    }

    async getMedia() {
        return this.call<ListMedia>('/v4/Media/List');
    }

    async getHashtags(media: Media) {
        return this.call<ListHashtag, ListHashtagParameter>('/v5/Hashtag/List', {
            applications: [
                {
                    platformId: media.platformId,
                    acdIndex: media.acdIndex,
                    extraData: media.extraData,
                    applicationId: media.applicationId,
                },
            ],
        });
    }

    async getActiveEvent() {
        return this.call<GetActiveEventResult>('/v1/Event/GetActiveEvent');
    }

    async getEvent(id: number) {
        return this.call<Event, {id: number}>('/v1/Event/Show', {
            id,
        });
    }

    async getUser(id: number) {
        return this.call<User, {id: number}>('/v3/User/Show', {
            id,
        });
    }

    async getFriendList() {
        return this.call<Friends_4>('/v4/Friend/List', {
            [RequestFlagAddPlatformSymbol]: true,
        });
    }

    async addFavouriteFriend(nsa_id: string) {
        return this.call('/v3/Friend/Favorite/Create', {
            nsaId: nsa_id,

            [RequestFlagAddPlatformSymbol]: true,
        });
    }

    async removeFavouriteFriend(nsa_id: string) {
        return this.call('/v3/Friend/Favorite/Delete', {
            nsaId: nsa_id,

            [RequestFlagAddPlatformSymbol]: true,
        });
    }

    /** @deprecated unused */
    async getFriend(nsa_id: string) {
        return this.call<Friend_4, {nsaId: string}>('/v4/Friend/Show', {
            nsaId: nsa_id,
        });
    }

    async getPlayLog(nsa_id: string) {
        return this.call<UserPlayLog, {nsaId: string}>('/v4/User/PlayLog/Show', {
            nsaId: nsa_id,
        });
    }

    async deleteFriendIsNew(nsa_id: string) {
        return this.call<{}, {friendNsaId: string}>('/v4/Friend/IsNew/Delete', {
            friendNsaId: nsa_id,
        });
    }

    async deleteFriend(nsa_id: string) {
        return this.call<{}, {nsaId: string}>('/v3/Friend/Delete', {
            nsaId: nsa_id,
        });
    }

    async getUserByFriendCode(friend_code: string, hash?: string) {
        if (!FRIEND_CODE.test(friend_code)) throw new Error('Invalid friend code');
        if (hash && !FRIEND_CODE_HASH.test(hash)) throw new Error('Invalid friend code hash');

        return hash ? this.call<FriendCodeUser, {friendCode: string; friendCodeHash: string}>('/v3/Friend/GetUserByFriendCodeHash', {
            friendCode: friend_code,
            friendCodeHash: hash,
        }) : this.call<FriendCodeUser, {friendCode: string}>('/v3/Friend/GetUserByFriendCode', {
            friendCode: friend_code,
        });
    }

    async sendFriendRequest(nsa_id: string, channel: CreateFriendRequestChannel = FriendRouteChannel.FRIEND_CODE) {
        return this.call('/v4/FriendRequest/Create', {
            nsaId: nsa_id,
            channel,
        });
    }

    async getReceivedFriendRequests() {
        return this.call<ReceivedFriendRequests>('/v4/FriendRequest/Received/List');
    }

    async getReceivedFriendRequest(friend_request_id: string) {
        return this.call<ReceivedFriendRequest, {id: string}>('/v4/FriendRequest/Received/Show', {
            id: friend_request_id,
        });
    }

    async setReceivedFriendRequestRead(friend_request_id: string) {
        return this.call('/v4/FriendRequest/Received/MarkAsRead', {
            id: friend_request_id,
        });
    }

    async acceptFriendRequest(friend_request_id: string) {
        return this.call('/v3/FriendRequest/Accept', {
            id: friend_request_id,
        });
    }

    async rejectFriendRequest(friend_request_id: string) {
        return this.call('/v3/FriendRequest/Reject', {
            id: friend_request_id,
        });
    }

    async getSentFriendRequests() {
        return this.call<SentFriendRequests>('/v3/FriendRequest/Sent/List');
    }

    async cancelFriendRequest(friend_request_id: string) {
        return this.call('/v3/FriendRequest/Cancel', {
            id: friend_request_id,
        });
    }

    async getBlockedUsers() {
        return this.call<BlockingUsers>('/v3/User/Block/List');
    }

    async addBlockedUser(nsa_id: string) {
        return this.call('/v3/User/Block/Create', {
            nsaId: nsa_id,
        });
    }

    async removeBlockedUser(nsa_id: string) {
        return this.call('/v3/User/Block/Delete', {
            nsaId: nsa_id,
        });
    }

    /**
     * For announcement types:
     *
     * - OPERATION
     */
    async setAnnouncementRead(id: string) {
        return this.call('/v4/Announcement/MarkAsRead', {
            id,

            [RequestFlagAddPlatformSymbol]: true,
        });
    }

    abstract getCurrentUser(): Promise<Result<CurrentUser>>;

    async getFriendCodeUrl() {
        return this.call<FriendCodeUrl>('/v3/Friend/CreateFriendCodeUrl', {
            [RequestFlagNoParameterSymbol]: true,
        });
    }

    async getCurrentUserPermissions() {
        return this.call<CurrentUserPermissions>('/v3/User/Permissions/ShowSelf', {
            [RequestFlagNoParameterSymbol]: true,
            [RequestFlagRequestIdSymbol]: RequestFlagRequestId.AFTER,
        });
    }

    /** @deprecated Use updateUserPresencePermissions */
    updateCurrentUserPermissions(to: PresencePermissions, from: PresencePermissions, etag: string): Promise<Result<{}>> {
        return this.updateUserPresencePermissions(to);
    }

    async updateUserPresencePermissions(value: PresencePermissions) {
        return this.call('/v4/User/Permissions/UpdateSelf', {
            permissions: {
                presence: value,
            },
        });
    }

    async updateUserPlayLogPermissions(value: PlayLogPermissions) {
        return this.call('/v4/User/Permissions/UpdateSelf', {
            permissions: {
                playLog: value,
            },
        });
    }

    async updateUserFriendRequestPermissions(value: boolean) {
        return this.call('/v4/User/Permissions/UpdateSelf', {
            permissions: {
                friendRequestReception: value,
            },
        });
    }

    async getNotificationSetting(item: UpdatePushNotificationSettingsParameterItem) {
        return this.call<ListPushNotificationSettings>('/v5/PushNotification/Settings/List');
    }

    async updateNotificationSetting(item: UpdatePushNotificationSettingsParameterItem) {
        return this.call<{}, UpdatePushNotificationSettingsParameter>('/v5/PushNotification/Settings/Update', [
            item,
        ]);
    }

    async updateFriendRequestNotificationSettings(value: boolean) {
        return this.updateNotificationSetting({
            type: 'friendRequest',
            value,
        });
    }

    async updateChatInvitationNotificationSettings(value: boolean) {
        return this.updateNotificationSetting({
            type: 'chatInvitation',
            value,
        });
    }

    async updatePlayInvitationNotificationSettings(scope: PushNotificationPlayInvitationScope) {
        return this.updateNotificationSetting({
            type: 'playInvitation',
            scope,
        });
    }

    async updateWebServiceNotificationSettings(id: number, value: boolean) {
        return this.updateNotificationSetting({
            type: 'gws',
            gwsId: id,
            value,
        });
    }

    async updateFriendOnlineNotificationSettings(nsa_id: string, value: boolean) {
        return this.updateNotificationSetting({
            type: 'friendOnline',
            value,
            friendId: nsa_id,
        });
    }

    async getUserLoginFactor() {
        return this.call<ShowUserLogin>('/v4/NA/User/LoginFactor/Show');
    }
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
const ZncaApiSymbol = Symbol('ZncaApi');
const ZncaApiPromiseSymbol = Symbol('ZncaApiPromise');

export const RequestFlagAddProductVersionSymbol = Symbol('RequestFlagAddProductVersion');
export const RequestFlagAddPlatformSymbol = Symbol('RequestFlagAddPlatform');
export const RequestFlagNoAuthenticationSymbol = Symbol('RequestFlagNoAuthentication');
export const RequestFlagNoEncryptionSymbol = Symbol('RequestFlagNoEncryption');
export const RequestFlagNoParameterSymbol = Symbol('RequestFlagNoParameter');
export const RequestFlagRequestIdSymbol = Symbol('RequestFlagRequestId');
export const RequestFlagNoAutoRenewTokenSymbol = Symbol('RequestFlagNoAutoRenewToken');
export const RequestFlagNxapiZncaApiRequestNsaAssertionSymbol = Symbol('RequestFlagNxapiZncaApiRequestNsaAssertion');

export interface RequestFlags {
    [RequestFlagAddProductVersionSymbol]: boolean;
    [RequestFlagAddPlatformSymbol]: boolean;
    [RequestFlagNoAuthenticationSymbol]: boolean;
    [RequestFlagNoEncryptionSymbol]: boolean;
    [RequestFlagNoParameterSymbol]: boolean;
    [RequestFlagRequestIdSymbol]: RequestFlagRequestId;
    [RequestFlagNoAutoRenewTokenSymbol]: boolean;
    [RequestFlagNxapiZncaApiRequestNsaAssertionSymbol]: boolean;
}
export enum RequestFlagRequestId {
    NONE,
    AFTER,
    BEFORE,
}

class EncryptedRequestBody<T = unknown> {
    constructor(
        readonly request_encryption: RequestEncryptionProvider,
        readonly encrypted: Uint8Array,
        readonly data: T | null = null,
    ) {}
}

export default class CoralApi extends AbstractCoralApi implements CoralApiInterface {
    [RemoteConfigSymbol]!: CoralRemoteConfig | null;
    [ClientInfoSymbol]: ClientInfo;
    [CoralUserIdSymbol]: number;
    [NintendoAccountIdSymbol]: string;
    [ZncaApiSymbol]: ZncaApi | null;
    [ZncaApiPromiseSymbol]: Promise<ZncaApi> | null;

    request_encryption: RequestEncryptionProvider | null = null;

    onTokenExpired: ((data?: CoralError, res?: Response) => Promise<CoralAuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;
    /** @internal */
    _token_expired = false;

    protected constructor(
        public token: string,
        public useragent: string | null = getAdditionalUserAgents(),
        coral_user_id: number,
        na_id: string,
        znca_version = ZNCA_VERSION,
        znca_useragent = ZNCA_USER_AGENT,
        znca_api?: ZncaApi | null,
        config?: CoralRemoteConfig,
    ) {
        super();

        this[ClientInfoSymbol] = {platform: ZNCA_PLATFORM, version: znca_version, useragent: znca_useragent};
        this[CoralUserIdSymbol] = coral_user_id;
        this[NintendoAccountIdSymbol] = na_id;
        this[ZncaApiSymbol] = znca_api ?? null;
        this[ZncaApiPromiseSymbol] = null;

        if (znca_api?.supportsEncryption()) {
            this.request_encryption = znca_api;
        }

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

    initZncaApi() {
        if (this[ZncaApiPromiseSymbol]) return this[ZncaApiPromiseSymbol];

        return this[ZncaApiPromiseSymbol] = createZncaApi({
            ...this[ClientInfoSymbol],
            useragent: this.useragent ?? getAdditionalUserAgents(),
        }).then(provider => {
            this[ZncaApiSymbol] = provider;

            if (provider.supportsEncryption()) {
                this.request_encryption = provider;
            }

            return provider;
        }).finally(() => this[ZncaApiPromiseSymbol] = null);
    }

    async fetch<T = unknown>(
        url: URL | string, method = 'GET', body?: string | Uint8Array | EncryptedRequestBody, _headers?: HeadersInit,
        flags: Partial<RequestFlags> = {},
    ): Promise<Result<T>> {
        if (!this[ZncaApiSymbol]) await this.initZncaApi();

        return (new CoralApiRequest<T>(this, url, method, body, _headers, flags)).fetch();
    }

    async call<T extends {}, R extends {}>(
        url: string, parameter: R & Partial<RequestFlags> = {} as R,
    ) {
        const body = {} as any;

        const ri = parameter[RequestFlagRequestIdSymbol] ?? RequestFlagRequestId.NONE;

        if (ri === RequestFlagRequestId.AFTER && !parameter[RequestFlagNoParameterSymbol]) body.parameter = parameter;

        if (ri !== RequestFlagRequestId.NONE) {
            // Android - lowercase, iOS - uppercase
            const uuid = randomUUID();
            body.requestId = uuid;
        }

        if (ri !== RequestFlagRequestId.AFTER && !parameter[RequestFlagNoParameterSymbol]) body.parameter = parameter;

        return this.fetch<T>(url, 'POST', JSON.stringify(body), {}, parameter);
    }

    async getCurrentUser() {
        return this.call<CurrentUser, {id: number}>('/v4/User/ShowSelf', {
            id: this[CoralUserIdSymbol],
        });
    }

    async getWebServiceToken(id: number, /** @internal */ _attempt = 0): Promise<Result<WebServiceToken>> {
        await this._renewToken;

        const parameter: WebServiceTokenParameter = {
            id,
            registrationToken: '',
            f: '',
            requestId: '',
            timestamp: 0,
        };

        const provider = this[ZncaApiSymbol] ?? await this.initZncaApi();

        const fdata = await provider.genf(this.token, HashMethod.WEB_SERVICE, {
            na_id: this[NintendoAccountIdSymbol], coral_user_id: '' + this[CoralUserIdSymbol],
        }, provider.supportsEncryption() ? {
            url: ZNC_URL + '/v4/Game/GetWebServiceToken',
            parameter,
        } : undefined);

        let body;

        if (provider.supportsEncryption() && fdata.encrypt_request_result) {
            body = new EncryptedRequestBody(provider, fdata.encrypt_request_result);
        } else {
            parameter.f = fdata.f;
            parameter.requestId = fdata.request_id;
            parameter.timestamp = fdata.timestamp;

            body = JSON.stringify({
                parameter,
            });

            if (provider.supportsEncryption()) {
                const result = await provider.encryptRequest(ZNC_URL + '/v4/Game/GetWebServiceToken', null, body);

                body = new EncryptedRequestBody(provider, result.data, body);
            }
        }

        try {
            return await this.fetch<WebServiceToken>('/v4/Game/GetWebServiceToken', 'POST', body, undefined, {
                [RequestFlagAddPlatformSymbol]: true,
                [RequestFlagAddProductVersionSymbol]: true,
                [RequestFlagNoAutoRenewTokenSymbol]: true,
                [RequestFlagNxapiZncaApiRequestNsaAssertionSymbol]: true,
            });
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

    async getToken(token: string, user: NintendoAccountUserCoral): Promise<PartialCoralAuthData> {
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        return this.getTokenWithNintendoAccountToken(nintendoAccountToken, user);
    }

    async getTokenWithNintendoAccountToken(
        nintendoAccountToken: NintendoAccountToken, user: NintendoAccountUserCoral,
    ): Promise<PartialCoralAuthData> {
        const parameter: AccountTokenParameter = {
            naBirthday: user.birthday,
            timestamp: 0,
            f: '',
            requestId: '',
            naIdToken: nintendoAccountToken.id_token,
        };

        const provider = this[ZncaApiSymbol] ?? await this.initZncaApi();

        const fdata = await provider.genf(nintendoAccountToken.id_token, HashMethod.CORAL, {
            na_id: user.id, coral_user_id: '' + this[CoralUserIdSymbol],
        }, provider.supportsEncryption() ? {
            url: ZNC_URL + '/v4/Account/GetToken',
            parameter,
        } : undefined);

        let body;

        if (provider.supportsEncryption() && fdata.encrypt_request_result) {
            body = new EncryptedRequestBody(provider, fdata.encrypt_request_result);
        } else {
            parameter.timestamp = fdata.timestamp;
            parameter.f = fdata.f;
            parameter.requestId = fdata.request_id;

            body = JSON.stringify({
                parameter,
            });

            if (provider.supportsEncryption()) {
                const result = await provider.encryptRequest(ZNC_URL + '/v4/Account/GetToken', null, body);

                body = new EncryptedRequestBody(provider, result.data, body);
            }
        }

        const data = await this.fetch<AccountToken_4>('/v4/Account/GetToken', 'POST', body, undefined, {
            [RequestFlagAddPlatformSymbol]: true,
            [RequestFlagAddProductVersionSymbol]: true,
            [RequestFlagNoAuthenticationSymbol]: true,
            [RequestFlagNoAutoRenewTokenSymbol]: true,
        });

        return {
            nintendoAccountToken,
            // user,
            f: fdata,
            nsoAccount: data,
            credential: data.webApiServerCredential,
        };
    }

    async renewToken(token: string, user: NintendoAccountUserCoral) {
        const data = await this.getToken(token, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    async renewTokenWithNintendoAccountToken(token: NintendoAccountToken, user: NintendoAccountUserCoral) {
        const data = await this.getTokenWithNintendoAccountToken(token, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    protected setTokenWithSavedToken(data: CoralAuthData | PartialCoralAuthData) {
        this.token = data.credential.accessToken;
        this[CoralUserIdSymbol] = data.nsoAccount.user.id;
        if ('user' in data) this[NintendoAccountIdSymbol] = data.user.id;
        this._token_expired = false;
    }

    static async createWithSessionToken(token: string, useragent = getAdditionalUserAgents()) {
        const data = await this.loginWithSessionToken(token, useragent);
        return {nso: this.createWithSavedToken(data, useragent), data};
    }

    static async createWithNintendoAccountToken(
        token: NintendoAccountToken, user: NintendoAccountUserCoral,
        useragent = getAdditionalUserAgents()
    ) {
        const data = await this.loginWithNintendoAccountToken(token, user, useragent);
        return {nso: this.createWithSavedToken(data, useragent), data};
    }

    static createWithSavedToken(data: CoralAuthData, useragent = getAdditionalUserAgents()) {
        return new this(
            data.credential.accessToken,
            useragent,
            data.nsoAccount.user.id,
            data.user.id,
            data.znca_version,
            data.znca_useragent,
            data[ZncaApiSymbol] ?? null,
        );
    }

    static async loginWithSessionToken(token: string, useragent = getAdditionalUserAgents()): Promise<CoralAuthData> {
        const { default: { coral: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents Coral authentication');

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNCA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser<NintendoAccountScope.USER_BIRTHDAY | NintendoAccountScope.USER_SCREENNAME>(nintendoAccountToken);

        return this.loginWithNintendoAccountToken(nintendoAccountToken, user, useragent);
    }

    static async loginWithNintendoAccountToken(
        nintendoAccountToken: NintendoAccountToken,
        user: NintendoAccountUserCoral,
        useragent = getAdditionalUserAgents(),
    ) {
        const { default: { coral: config } } = await import('../common/remote-config.js');

        if (!config) throw new Error('Remote configuration prevents Coral authentication');
        const znca_useragent = `com.nintendo.znca/${config.znca_version}(${ZNCA_PLATFORM}/${ZNCA_PLATFORM_VERSION})`;

        const provider = await createZncaApi({
            platform: ZNCA_PLATFORM,
            version: config.znca_version,
            useragent,
        });

        const parameter: AccountLoginParameter = {
            naIdToken: nintendoAccountToken.id_token,
            naBirthday: user.birthday,
            naCountry: user.country,
            language: user.language,

            // These fields will be filled by the f-generation API when encrypting the request data
            timestamp: 0,
            requestId: '',
            f: '',
        };

        const fdata = await provider.genf(nintendoAccountToken.id_token, HashMethod.CORAL, {
            na_id: user.id,
        }, provider.supportsEncryption() ? {
            url: ZNC_URL + '/v4/Account/Login',
            parameter,
        } : undefined);

        debug('fdata', fdata);

        debug('Getting Nintendo Switch Online app token');

        let encrypted: [RequestEncryptionProvider] | null = null;
        let body;

        if (provider.supportsEncryption() && fdata.encrypt_request_result) {
            encrypted = [provider];
            body = fdata.encrypt_request_result;
        } else {
            parameter.timestamp = fdata.timestamp;
            parameter.requestId = fdata.request_id;
            parameter.f = fdata.f;

            body = JSON.stringify({
                parameter,
            });

            if (provider.supportsEncryption()) {
                const result = await provider.encryptRequest(ZNC_URL + '/v4/Account/Login', null, body);

                encrypted = [provider];
                body = result.data;
            }
        }

        const headers = new Headers({
            'X-Platform': ZNCA_PLATFORM,
            'X-ProductVersion': config.znca_version,
            'Content-Type': encrypted ? 'application/octet-stream' : 'application/json; charset=utf-8',
            'Accept': (encrypted ? 'application/octet-stream,' : '') + 'application/json',
            'User-Agent': znca_useragent,
        });

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(ZNC_URL + '/v4/Account/Login', {
            method: 'POST',
            headers,
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', 'POST', '/v4/Account/Login', response.status);

        if (response.status !== 200) {
            throw await CoralErrorResponse.fromResponse(response, '[znc] Non-200 status code');
        }

        const data: CoralResponse<AccountLogin_4> = encrypted ?
            JSON.parse((await encrypted[0].decryptResponse(new Uint8Array(await response.arrayBuffer()))).data) :
            await response.json() as CoralResponse<AccountLogin_4>;

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

            [ZncaApiSymbol]: provider,
        };
    }
}

class CoralApiRequest<T = unknown> {
    constructor(
        readonly coral: CoralApi,

        readonly url: URL | string,
        readonly method: string,
        readonly body: string | Uint8Array | EncryptedRequestBody | undefined,
        readonly headers: HeadersInit | undefined,
        readonly flags: Partial<RequestFlags>,
    ) {}

    async fetch(_attempt = 0): Promise<Result<T>> {
        if (!this.flags[RequestFlagNoAutoRenewTokenSymbol]) {
            if (this.coral._token_expired && !this.coral._renewToken) {
                if (!this.coral.onTokenExpired || _attempt) throw new Error('Token expired');

                this.coral._renewToken = this.coral.onTokenExpired.call(null).then(data => {
                    // @ts-expect-error
                    if (data) this.coral.setTokenWithSavedToken(data);
                }).finally(() => {
                    this.coral._renewToken = null;
                });
            }

            if (this.coral._renewToken) {
                await this.coral._renewToken;
            }
        }

        const headers = new Headers(this.headers);

        headers.append('Content-Type', 'application/json');
        headers.append('Accept-Language', 'en-GB');

        if (this.flags[RequestFlagAddProductVersionSymbol]) {
            headers.append('X-ProductVersion', this.coral[ClientInfoSymbol].version);
        }

        headers.append('Accept', 'application/json');

        headers.append('User-Agent', this.coral[ClientInfoSymbol].useragent);

        if (!this.flags[RequestFlagNoAuthenticationSymbol] && this.coral.token) {
            headers.append('Authorization', 'Bearer ' + this.coral.token);
        }

        if (this.flags[RequestFlagAddPlatformSymbol]) {
            headers.append('X-Platform', this.coral[ClientInfoSymbol].platform);
        }

        headers.append('Pragma', 'no-cache');
        headers.append('Cache-Control', 'no-cache');

        let body = this.body;
        let encrypted: [RequestEncryptionProvider] | null = null;

        if (this.coral.request_encryption && typeof this.body === 'string' && !this.flags[RequestFlagNoEncryptionSymbol]) {
            const result = await this.coral.request_encryption.encryptRequest(
                new URL(this.url, ZNC_URL).href,
                !this.flags[RequestFlagNoAuthenticationSymbol] && this.coral.token ? this.coral.token : null,
                this.body,
            );

            headers.set('Content-Type', 'application/octet-stream');
            headers.set('Accept', 'application/octet-stream,application/json');

            body = result.data;
            encrypted = [this.coral.request_encryption];
        }

        if (body instanceof EncryptedRequestBody) {
            const result = body;

            headers.set('Content-Type', 'application/octet-stream');
            headers.set('Accept', 'application/octet-stream,application/json');

            body = result.encrypted;
            encrypted = [result.request_encryption];
        }

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(new URL(this.url, ZNC_URL), {
            method: this.method,
            headers,
            body,
            signal,
        }).finally(cancel);

        return this.handleResponse(response, encrypted?.[0], _attempt);
    }

    async handleResponse(
        response: Response, request_encryption: RequestEncryptionProvider | undefined,
        /** @internal */ _attempt: number,
    ) {
        const data = new Uint8Array(await response.arrayBuffer());

        if (response.headers.get('Content-Type')?.match(/^application\/json($|;)/i)) {
            if (request_encryption) {
                return this.handleEncryptedJsonResponse(response, data, request_encryption, _attempt);
            }

            return this.decodeJsonResponse(response, data, null, _attempt);
        }

        if (!response.ok) {
            throw new CoralErrorResponse('[znc] Non-200 status code', response, data);
        }

        throw new CoralErrorResponse('[znc] Unacceptable response type', response, data);
    }

    private async handleEncryptedJsonResponse(
        response: Response, data: Uint8Array,
        request_encryption: RequestEncryptionProvider,
        /** @internal */ _attempt: number,
    ) {
        debug('decrypting response', this.url, data.length);

        const decrypted = request_encryption instanceof ZncaApiNxapi ?
            await request_encryption.decryptResponse(data,
                request_encryption.auth?.has_nsa_assertion_scope &&
                    this.flags[RequestFlagNxapiZncaApiRequestNsaAssertionSymbol]) :
            await request_encryption.decryptResponse(data);

        const encryption: ResponseEncryption = {
            encrypted: data,
            decrypt_result: decrypted,
        };

        return this.decodeJsonResponse(response, decrypted.data, encryption, _attempt);
    }

    private async decodeJsonResponse(
        response: Response, data: string | Uint8Array, encryption: ResponseEncryption | null,
        /** @internal */ _attempt: number,
    ) {
        let json: CoralResponse<T>;

        try {
            const decoded = typeof data === 'string' ? data : (new TextDecoder()).decode(data);
            json = JSON.parse(decoded);
        } catch (err) {
            if (!response.ok) {
                throw new CoralErrorResponse('[znc] Non-200 status code', response, data);
            }

            throw new CoralErrorResponse('Error parsing JSON response', response, data);
        }

        if (!response.ok) {
            throw new CoralErrorResponse('[znc] Non-200 status code', response, json as CoralError);
        }

        return this.handleJsonResponse(response, json, encryption, _attempt);
    }

    private async handleJsonResponse(
        response: Response, data: CoralResponse<T>, encryption: ResponseEncryption | null,
        /** @internal */ _attempt: number,
    ) {
        debug('fetch %s %s, response %s, status %d %s, correlationId %s', this.method, this.url, response.status,
            data.status, CoralStatus[data.status], data?.correlationId);

        if (data.status === CoralStatus.TOKEN_EXPIRED && !this.flags[RequestFlagNoAutoRenewTokenSymbol] && !_attempt && this.coral.onTokenExpired) {
            this.coral._token_expired = true;
            // _renewToken will be awaited when calling fetch
            this.coral._renewToken = this.coral._renewToken ?? this.coral.onTokenExpired.call(null, data, response).then(data => {
                // @ts-expect-error
                if (data) this.coral.setTokenWithSavedToken(data);
            }).finally(() => {
                this.coral._renewToken = null;
            });
            return this.fetch(_attempt + 1);
        }

        if ('errorMessage' in data) {
            throw new CoralErrorResponse('[znc] ' + data.errorMessage, response, data);
        }
        if (data.status !== CoralStatus.OK) {
            throw new CoralErrorResponse('[znc] Unknown error', response, data);
        }

        const result = data.result;

        Object.defineProperty(result, ResponseSymbol, {enumerable: false, value: response});
        Object.defineProperty(result, ResponseEncryptionSymbol, {enumerable: false, value: encryption});
        Object.defineProperty(result, ResponseDataSymbol, {enumerable: false, value: data});
        Object.defineProperty(result, CorrelationIdSymbol, {enumerable: false, value: data.correlationId});

        Object.defineProperty(result, 'status', {enumerable: false, value: CoralStatus.OK});
        Object.defineProperty(result, 'result', {enumerable: false, value: data.result});
        Object.defineProperty(result, 'correlationId', {enumerable: false, value: data.correlationId});

        return result as Result<T>;
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
    scope: 'openid user user.birthday user.screenName',
};

export type NintendoAccountUserCoral =
    NintendoAccountUser<NintendoAccountScope.USER | NintendoAccountScope.USER_BIRTHDAY | NintendoAccountScope.USER_SCREENNAME> |
    // Nintendo Account session token obtained before 3.0.1
    NintendoAccountUser<NintendoAccountScope.USER | NintendoAccountScope.USER_BIRTHDAY | NintendoAccountScope.USER_MII | NintendoAccountScope.USER_SCREENNAME>;

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
    user: NintendoAccountUserCoral;
    f: FResult;
    nsoAccount: AccountLogin | AccountLogin_4;
    credential: AccountLogin['webApiServerCredential'];
    znca_version: string;
    znca_useragent: string;

    [ZncaApiSymbol]?: ZncaApi;
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
