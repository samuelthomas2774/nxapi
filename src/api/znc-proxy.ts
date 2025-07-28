import { fetch, Response } from 'undici';
import { ActiveEvent, CurrentUser, Event, Friend, PresencePermissions, User, WebServiceToken, CoralStatus, CoralSuccessResponse, FriendCodeUser, FriendCodeUrl, WebService_4, Media, Announcements_4, Friend_4, PresenceOnline_4, PresenceOnline, PresenceOffline, GetActiveEventResult, ReceivedFriendRequest, SentFriendRequest } from './coral-types.js';
import { defineResponse, ErrorResponse, ResponseSymbol } from './util.js';
import { AbstractCoralApi, CoralApiInterface, CoralAuthData, CorrelationIdSymbol, PartialCoralAuthData, RequestFlagAddPlatformSymbol, RequestFlagAddProductVersionSymbol, RequestFlagNoParameterSymbol, RequestFlagRequestIdSymbol, RequestFlags, ResponseDataSymbol, ResponseEncryptionSymbol, Result } from './coral.js';
import { NintendoAccountToken, NintendoAccountUser } from './na.js';
import { SavedToken } from '../common/auth/coral.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { getAdditionalUserAgents, getUserAgent } from '../util/useragent.js';

const debug = createDebug('nxapi:api:znc-proxy');

export default class ZncProxyApi extends AbstractCoralApi implements CoralApiInterface {
    constructor(
        private url: URL | string,
        // ZncApi uses the NSO token (valid for a few hours)
        // ZncProxyApi uses the Nintendo Account session token (valid for two years)
        public token: string,
        public useragent = getAdditionalUserAgents()
    ) {
        super();
    }

    async fetchProxyApi<T = unknown>(url: URL | string, method = 'GET', body?: string, _headers?: HeadersInit) {
        if (typeof url === 'string' && url.startsWith('/')) url = url.substring(1);

        const base_url = typeof this.url === 'string' ? new URL(this.url) : this.url;
        if (typeof this.url === 'string' && !base_url.pathname.endsWith('/')) base_url.pathname += '/';

        const headers = new Headers(_headers);

        headers.append('Authorization', 'na ' + this.token);
        headers.append('User-Agent', getUserAgent(this.useragent));

        if (body && !headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
        }

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(new URL(url, base_url), {
            method,
            headers,
            body,
            signal,
        }).finally(cancel);

        const debug_url = typeof url === 'string' ? '/' + url : url.toString();
        debug('fetch %s %s, response %s', method, debug_url, response.status);

        if (!response.ok) {
            throw await ZncProxyErrorResponse.fromResponse(response, '[zncproxy] Non-2xx status code');
        }

        const data = (response.status === 204 ? {} : await response.json()) as T;

        return defineResponse(data, response);
    }

    async call<T extends {}, R extends {}>(url: string, parameter: R & Partial<RequestFlags> = {} as R): Promise<Result<T>> {
        const options: [string, unknown][] = [];

        if (parameter[RequestFlagAddPlatformSymbol]) options.push(['add_platform', true]);
        if (parameter[RequestFlagAddProductVersionSymbol]) options.push(['add_version', true]);
        if (parameter[RequestFlagNoParameterSymbol]) options.push(['no_parameter', true]);
        if (RequestFlagRequestIdSymbol in parameter) options.push(['request_id', parameter[RequestFlagRequestIdSymbol]]);

        const result = await this.fetchProxyApi<{result: T}>('call', 'POST', JSON.stringify({
            url,
            parameter,

            options: options.length ? Object.fromEntries(options) : undefined,
        }));

        return createResult(result, result.result);
    }

    async getAnnouncements() {
        const result = await this.fetchProxyApi<{announcements: Announcements_4}>('announcements');
        return createResult(result, result.announcements);
    }

    async getFriendList() {
        const result = await this.fetchProxyApi<{friends: Friend_4[]; extract_ids?: string[]}>('friends');

        return createResult(result, Object.assign(result, {
            extractFriendsIds: result.extract_ids ?? result.friends.slice(0, 10).map(f => f.nsaId),
        }));
    }

    async getFriend(nsa_id: string) {
        const result = await this.fetchProxyApi<{friend: Friend_4}>('friend/' + nsa_id);
        return createResult(result, result.friend);
    }

    async addFavouriteFriend(nsa_id: string) {
        const result = await this.fetchProxyApi('friend/' + nsa_id, 'PATCH', JSON.stringify({
            isFavoriteFriend: true,
        }));
        return createResult(result, {});
    }

    async removeFavouriteFriend(nsa_id: string) {
        const result = await this.fetchProxyApi('friend/' + nsa_id, 'PATCH', JSON.stringify({
            isFavoriteFriend: false,
        }));
        return createResult(result, {});
    }

    async deleteFriendIsNew(nsa_id: string) {
        const result = await this.fetchProxyApi('friend/' + nsa_id, 'PATCH', JSON.stringify({
            isNew: false,
        }));
        return createResult(result, {});
    }

    async getWebServices() {
        const result = await this.fetchProxyApi<{webservices: WebService_4[]}>('webservices');
        return createResult(result, result.webservices);
    }

    async getChats() {
        const result = await this.fetchProxyApi<{chats: unknown[]}>('chats');
        return createResult(result, result.chats);
    }

    async getMedia() {
        const result = await this.fetchProxyApi<{media: Media[]}>('media');
        return createResult(result, result);
    }

    async getActiveEvent() {
        const result = await this.fetchProxyApi<{activeevent: ActiveEvent | null}>('activeevent');
        return createResult<GetActiveEventResult, typeof result>(result, result.activeevent ?? {});
    }

    async getEvent(id: number) {
        const result = await this.fetchProxyApi<{event: Event}>('event/' + id);
        return createResult(result, result.event);
    }

    async getUser(id: number) {
        const result = await this.fetchProxyApi<{user: User}>('user/' + id);
        return createResult(result, result.user);
    }

    async getUserByFriendCode(friend_code: string, hash?: string) {
        const result = await this.fetchProxyApi<{user: FriendCodeUser}>('friendcode/' + friend_code);
        return createResult(result, result.user);
    }

    // async sendFriendRequest(nsa_id: string): Promise<Result<{}>> {
    //     throw new Error('Not supported in ZncProxyApi');
    // }

    async getCurrentUser() {
        const result = await this.fetchProxyApi<{user: CurrentUser}>('user');
        return createResult(result, result.user);
    }

    async getReceivedFriendRequests() {
        const result = await this.fetchProxyApi<{friend_requests: ReceivedFriendRequest[]}>('friends/requests/received');
        return createResult(result, {friendRequests: result.friend_requests});
    }

    async getSentFriendRequests() {
        const result = await this.fetchProxyApi<{friend_requests: SentFriendRequest[]}>('friends/requests/sent');
        return createResult(result, {friendRequests: result.friend_requests});
    }

    async getFriendCodeUrl() {
        const result = await this.fetchProxyApi<{friendcode: FriendCodeUrl}>('friendcode');
        return createResult(result, result.friendcode);
    }

    async getCurrentUserPermissions() {
        const user = await this.getCurrentUser();

        return createResult(user, {
            etag: user.etag,
            permissions: user.permissions,
        });
    }

    // async updateCurrentUserPermissions(
    //     to: PresencePermissions, from: PresencePermissions, etag: string
    // ): Promise<Result<{}>> {
    //     throw new Error('Not supported in ZncProxyApi');
    // }

    async updateFriendOnlineNotificationSettings(nsa_id: string, value: boolean) {
        const result = await this.fetchProxyApi('friend/' + nsa_id, 'PATCH', JSON.stringify({
            isOnlineNotificationEnabled: value,
        }));
        return createResult(result, {});
    }

    async getWebServiceToken(id: number) {
        const result = await this.fetchProxyApi<{token: WebServiceToken}>('webservice/' + id + '/token');
        return createResult(result, result.token);
    }

    async getToken(token: string, user: NintendoAccountUser): Promise<PartialCoralAuthData> {
        throw new Error('Not supported in ZncProxyApi');
    }

    getTokenWithNintendoAccountToken(
        token: NintendoAccountToken, user: NintendoAccountUser,
    ): Promise<PartialCoralAuthData> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async renewToken() {
        const data = await this.fetchProxyApi<SavedToken>('auth');
        data.proxy_url = this.url.toString();
        return data;
    }

    renewTokenWithNintendoAccountToken(
        token: NintendoAccountToken, user: NintendoAccountUser,
    ): Promise<PartialCoralAuthData> {
        throw new Error('Not supported in ZncProxyApi');
    }

    protected setTokenWithSavedToken(data: CoralAuthData | PartialCoralAuthData) {
        throw new Error('Not supported in ZncProxyApi');
    }

    static async createWithSessionToken(url: string, token: string) {
        const nso = new this(url, token);
        const data = await nso.fetchProxyApi<SavedToken>('auth');
        data.proxy_url = url;

        return {nso, data};
    }
}

function createResult<T extends {}, R>(data: R & {[ResponseSymbol]: Response}, result: T): Result<T> {
    const coral_result: CoralSuccessResponse<T> = {
        status: CoralStatus.OK as const,
        result,
        correlationId: '',
    };

    Object.defineProperty(result, ResponseSymbol, {enumerable: false, value: data[ResponseSymbol]});
    Object.defineProperty(result, ResponseEncryptionSymbol, {enumerable: false, value: null});
    Object.defineProperty(result, ResponseDataSymbol, {enumerable: false, value: coral_result});
    Object.defineProperty(result, CorrelationIdSymbol, {enumerable: false, value: ''});

    Object.defineProperty(result, 'status', {enumerable: false, value: CoralStatus.OK});
    Object.defineProperty(result, 'result', {enumerable: false, value: result});
    Object.defineProperty(result, 'correlationId', {enumerable: false, value: ''});

    return result as Result<T>;
}

export class ZncProxyErrorResponse extends ErrorResponse {}

export interface AuthToken {
    user: string;
    policy?: AuthPolicy;
    created_at: number;
}
export interface AuthPolicy {
    api?: boolean;

    announcements?: boolean;
    list_friends?: boolean;
    list_friends_presence?: boolean;
    friend?: boolean;
    friend_presence?: boolean;
    list_friend_requests?: boolean;
    webservices?: boolean;
    activeevent?: boolean;
    chats?: boolean;
    media?: boolean;
    current_user?: boolean;
    current_user_presence?: boolean;

    friends?: string[];
    friends_presence?: string[];
}

export enum ZncPresenceEventStreamEvent {
    FRIEND_ONLINE = '0',
    FRIEND_OFFLINE = '1',
    FRIEND_TITLE_CHANGE = '2',
    FRIEND_TITLE_STATECHANGE = '3',
    PRESENCE_UPDATED = '4',
}

export type PresenceUrlResponse =
    PresenceOnline | PresenceOnline_4 | PresenceOffline |
    {presence: PresenceOnline | PresenceOnline_4 | PresenceOffline} |
    CurrentUser | {user: CurrentUser} |
    Friend | {friend: Friend};

export async function getPresenceFromUrl(presence_url: string, useragent?: string) {
    const [signal, cancel, controller] = timeoutSignal();
    const response = await fetch(presence_url, {
        headers: {
            'User-Agent': getUserAgent(useragent),
        },
        signal,
    }).finally(cancel);

    debug('fetch %s %s, response %s', 'GET', presence_url, response.status);

    if (response.status !== 200) {
        throw await ZncProxyErrorResponse.fromResponse(response, '[zncproxy] Non-200 status code');
    }

    if (!response.headers.get('Content-Type')?.match(/^application\/json(;|$)$/)) {
        response.body?.cancel();
        throw new ZncProxyErrorResponse('[zncproxy] Unacceptable content type', response);
    }

    const data = await response.json() as PresenceUrlResponse;

    const user: CurrentUser | Friend | Friend_4 | undefined =
        'user' in data ? data.user :
        'friend' in data ? data.friend :
        'nsaId' in data ? data :
        undefined;
    const presence: PresenceOnline | PresenceOnline_4 | PresenceOffline =
        'presence' in data ? data.presence :
        'user' in data ? data.user.presence :
        'friend' in data ? data.friend.presence :
        data;

    if (!('state' in presence)) {
        throw new Error('Invalid presence data');
    }

    return defineResponse([presence, user, data as unknown] as const, response);
}
