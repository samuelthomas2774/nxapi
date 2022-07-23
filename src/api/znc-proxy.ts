import fetch, { Response } from 'node-fetch';
import createDebug from 'debug';
import { ActiveEvent, Announcements, CurrentUser, Event, Friend, Presence, PresencePermissions, User, WebService, WebServiceToken, CoralErrorResponse, CoralStatus, CoralSuccessResponse } from './coral-types.js';
import { ErrorResponse } from './util.js';
import CoralApi from './coral.js';
import { NintendoAccountUser } from './na.js';
import { SavedToken } from '../common/auth/nso.js';
import { timeoutSignal } from '../util/misc.js';
import { getAdditionalUserAgents, getUserAgent } from '../util/useragent.js';

const debug = createDebug('nxapi:api:znc-proxy');

export default class ZncProxyApi implements CoralApi {
    // Not used by ZncProxyApi
    onTokenExpired: ((data: CoralErrorResponse, res: Response) => Promise<void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;

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

        if (response.status === 204) return null!;

        if (response.status !== 200) {
            throw new ErrorResponse('[zncproxy] Unknown error', response, await response.text());
        }

        const data = await response.json() as T;

        return data;
    }

    async call<T = unknown>(url: string, parameter = {}): Promise<CoralSuccessResponse<T>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getAnnouncements() {
        const response = await this.fetch<{announcements: Announcements}>('/announcements');
        return {status: CoralStatus.OK as const, result: response.announcements, correlationId: ''};
    }

    async getFriendList() {
        const response = await this.fetch<{friends: Friend[]}>('/friends');
        return {status: CoralStatus.OK as const, result: response, correlationId: ''};
    }

    async addFavouriteFriend(nsaid: string) {
        await this.fetch('/friend/' + nsaid, 'POST', JSON.stringify({
            isFavoriteFriend: true,
        }));
        return {status: CoralStatus.OK as const, result: {}, correlationId: ''};
    }

    async removeFavouriteFriend(nsaid: string) {
        await this.fetch('/friend/' + nsaid, 'POST', JSON.stringify({
            isFavoriteFriend: false,
        }));
        return {status: CoralStatus.OK as const, result: {}, correlationId: ''};
    }

    async getWebServices() {
        const response = await this.fetch<{webservices: WebService[]}>('/webservices');
        return {status: CoralStatus.OK as const, result: response.webservices, correlationId: ''};
    }

    async getActiveEvent() {
        const response = await this.fetch<{activeevent: ActiveEvent}>('/activeevent');
        return {status: CoralStatus.OK as const, result: response.activeevent, correlationId: ''};
    }

    async getEvent(id: number) {
        const response = await this.fetch<{event: Event}>('/event/' + id);
        return {status: CoralStatus.OK as const, result: response.event, correlationId: ''};
    }

    async getUser(id: number) {
        const response = await this.fetch<{user: User}>('/user/' + id);
        return {status: CoralStatus.OK as const, result: response.user, correlationId: ''};
    }

    async getCurrentUser() {
        const response = await this.fetch<{user: CurrentUser}>('/user');
        return {status: CoralStatus.OK as const, result: response.user, correlationId: ''};
    }

    async getCurrentUserPermissions() {
        const user = await this.getCurrentUser();

        return {
            status: CoralStatus.OK as const,
            result: {
                etag: user.result.etag,
                permissions: user.result.permissions,
            },
            correlationId: '',
        };
    }

    async updateCurrentUserPermissions(
        to: PresencePermissions, from: PresencePermissions, etag: string
    ): Promise<CoralSuccessResponse<{}>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getWebServiceToken(id: string) {
        const response = await this.fetch<{token: WebServiceToken}>('/webservice/' + id + '/token');
        return {status: CoralStatus.OK as const, result: response.token, correlationId: ''};
    }

    async getToken(token: string, user: NintendoAccountUser): ReturnType<CoralApi['getToken']> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async renewToken() {
        const data = await this.fetch<SavedToken>('/auth');
        data.proxy_url = this.url;
        return data;
    }

    static async createWithSessionToken(url: string, token: string) {
        const nso = new this(url, token);
        const data = await nso.fetch<SavedToken>('/auth');
        data.proxy_url = url;

        return {nso, data};
    }
}

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
    const [signal, cancel] = timeoutSignal();
    const response = await fetch(presence_url, {
        headers: {
            'User-Agent': getUserAgent(useragent),
        },
        signal,
    }).finally(cancel);

    debug('fetch %s %s, response %s', 'GET', presence_url, response.status);

    if (response.status !== 200) {
        throw new ErrorResponse('[zncproxy] Unknown error', response, await response.text());
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

    return [presence, user] as const;
}
