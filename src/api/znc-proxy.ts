import { fetch, Response } from 'undici';
import { ActiveEvent, Announcements, CurrentUser, Event, Friend, Presence, PresencePermissions, User, WebService, WebServiceToken, CoralStatus, CoralSuccessResponse, FriendCodeUser, FriendCodeUrl } from './coral-types.js';
import { defineResponse, ErrorResponse, ResponseSymbol } from './util.js';
import { CoralApiInterface, CoralAuthData, CorrelationIdSymbol, PartialCoralAuthData, ResponseDataSymbol, Result } from './coral.js';
import { NintendoAccountToken, NintendoAccountUser } from './na.js';
import { SavedToken } from '../common/auth/coral.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { getAdditionalUserAgents, getUserAgent } from '../util/useragent.js';

const debug = createDebug('nxapi:api:znc-proxy');

export default class ZncProxyApi implements CoralApiInterface {
    constructor(
        private url: string,
        // ZncApi uses the NSO token (valid for a few hours)
        // ZncProxyApi uses the Nintendo Account session token (valid for two years)
        public token: string,
        public useragent = getAdditionalUserAgents()
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const [signal, cancel] = timeoutSignal();
        const response = await fetch(this.url + url, {
            method,
            headers: Object.assign({
                'Authorization': 'na ' + this.token,
                'User-Agent': getUserAgent(this.useragent),
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (!response.ok) {
            throw await ZncProxyErrorResponse.fromResponse(response, '[zncproxy] Non-2xx status code');
        }

        const data = (response.status === 204 ? {} : await response.json()) as T;

        return defineResponse(data, response);
    }

    async call<T = unknown>(url: string, parameter = {}): Promise<Result<T>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getAnnouncements() {
        const result = await this.fetch<{announcements: Announcements}>('/announcements');
        return createResult(result, result.announcements);
    }

    async getFriendList() {
        const result = await this.fetch<{friends: Friend[]}>('/friends');
        return createResult(result, result);
    }

    async addFavouriteFriend(nsa_id: string) {
        const result = await this.fetch('/friend/' + nsa_id, 'POST', JSON.stringify({
            isFavoriteFriend: true,
        }));
        return createResult(result, {});
    }

    async removeFavouriteFriend(nsa_id: string) {
        const result = await this.fetch('/friend/' + nsa_id, 'POST', JSON.stringify({
            isFavoriteFriend: false,
        }));
        return createResult(result, {});
    }

    async getWebServices() {
        const result = await this.fetch<{webservices: WebService[]}>('/webservices');
        return createResult(result, result.webservices);
    }

    async getActiveEvent() {
        const result = await this.fetch<{activeevent: ActiveEvent}>('/activeevent');
        return createResult(result, result.activeevent);
    }

    async getEvent(id: number) {
        const result = await this.fetch<{event: Event}>('/event/' + id);
        return createResult(result, result.event);
    }

    async getUser(id: number) {
        const result = await this.fetch<{user: User}>('/user/' + id);
        return createResult(result, result.user);
    }

    async getUserByFriendCode(friend_code: string, hash?: string) {
        const result = await this.fetch<{user: FriendCodeUser}>('/friendcode/' + friend_code);
        return createResult(result, result.user);
    }

    async sendFriendRequest(nsa_id: string): Promise<Result<{}>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getCurrentUser() {
        const result = await this.fetch<{user: CurrentUser}>('/user');
        return createResult(result, result.user);
    }

    async getFriendCodeUrl() {
        const result = await this.fetch<{friendcode: FriendCodeUrl}>('/friendcode');
        return createResult(result, result.friendcode);
    }

    async getCurrentUserPermissions() {
        const user = await this.getCurrentUser();

        return createResult(user, {
            etag: user.etag,
            permissions: user.permissions,
        });
    }

    async updateCurrentUserPermissions(
        to: PresencePermissions, from: PresencePermissions, etag: string
    ): Promise<Result<{}>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getWebServiceToken(id: number) {
        const result = await this.fetch<{token: WebServiceToken}>('/webservice/' + id + '/token');
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
        const data = await this.fetch<SavedToken>('/auth');
        data.proxy_url = this.url;
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
        const data = await nso.fetch<SavedToken>('/auth');
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
    announcements?: boolean;
    list_friends?: boolean;
    list_friends_presence?: boolean;
    friend?: boolean;
    friend_presence?: boolean;
    webservices?: boolean;
    activeevent?: boolean;
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
    Presence | {presence: Presence} |
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

    const user: CurrentUser | Friend | undefined =
        'user' in data ? data.user :
        'friend' in data ? data.friend :
        'nsaId' in data ? data :
        undefined;
    const presence: Presence =
        'presence' in data ? data.presence :
        'user' in data ? data.user.presence :
        'friend' in data ? data.friend.presence :
        data;

    if (!('state' in presence)) {
        throw new Error('Invalid presence data');
    }

    return defineResponse([presence, user, data as unknown] as const, response);
}
