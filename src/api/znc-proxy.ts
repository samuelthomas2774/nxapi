import fetch from 'node-fetch';
import createDebug from 'debug';
import { ActiveEvent, Announcements, CurrentUser, Event, Friend, PresencePermissions, User, WebService, WebServiceToken, ZncStatus, ZncSuccessResponse } from './znc-types.js';
import { ErrorResponse } from './util.js';
import ZncApi from './znc.js';
import { SavedToken, version } from '../util.js';
import { NintendoAccountUser } from './na.js';

const debug = createDebug('api:znc-proxy');

export default class ZncProxyApi implements ZncApi {
    static useragent: string | null = null;

    constructor(
        private url: string,
        // ZncApi uses the NSO token (valid for a few hours)
        // ZncProxyApi uses the Nintendo Account session token (valid for two years)
        public token: string,
        public useragent = ZncProxyApi.useragent
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const response = await fetch(this.url + url, {
            method: method,
            headers: Object.assign({
                'Authorization': 'na ' + this.token,
                'User-Agent': (this.useragent ? this.useragent + ' ' : '') + 'nxapi/' + version,
            }, headers),
            body: body,
        });

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status === 204) return null!;

        if (response.status !== 200) {
            throw new ErrorResponse('[zncproxy] Unknown error', response);
        }

        const data = await response.json() as T;

        return data;
    }

    async getAnnouncements() {
        const response = await this.fetch<{announcements: Announcements}>('/announcements');
        return {status: ZncStatus.OK as const, result: response.announcements, correlationId: ''};
    }

    async getFriendList() {
        const response = await this.fetch<{friends: Friend[]}>('/friends');
        return {status: ZncStatus.OK as const, result: response, correlationId: ''};
    }

    async addFavouriteFriend(nsaid: string) {
        await this.fetch('/friend/' + nsaid, 'POST', JSON.stringify({
            isFavoriteFriend: true,
        }));
        return {status: ZncStatus.OK as const, result: {}, correlationId: ''};
    }

    async removeFavouriteFriend(nsaid: string) {
        await this.fetch('/friend/' + nsaid, 'POST', JSON.stringify({
            isFavoriteFriend: false,
        }));
        return {status: ZncStatus.OK as const, result: {}, correlationId: ''};
    }

    async getWebServices() {
        const response = await this.fetch<{webservices: WebService[]}>('/webservices');
        return {status: ZncStatus.OK as const, result: response.webservices, correlationId: ''};
    }

    async getActiveEvent() {
        const response = await this.fetch<{activeevent: ActiveEvent}>('/activeevent');
        return {status: ZncStatus.OK as const, result: response.activeevent, correlationId: ''};
    }

    async getEvent(id: number) {
        const response = await this.fetch<{event: Event}>('/event/' + id);
        return {status: ZncStatus.OK as const, result: response.event, correlationId: ''};
    }

    async getUser(id: number) {
        const response = await this.fetch<{user: User}>('/user/' + id);
        return {status: ZncStatus.OK as const, result: response.user, correlationId: ''};
    }

    async getCurrentUser() {
        const response = await this.fetch<{user: CurrentUser}>('/user');
        return {status: ZncStatus.OK as const, result: response.user, correlationId: ''};
    }

    async getCurrentUserPermissions() {
        const user = await this.getCurrentUser();

        return {
            status: ZncStatus.OK as const,
            result: {
                etag: user.result.etag,
                permissions: user.result.permissions,
            },
            correlationId: '',
        };
    }

    async updateCurrentUserPermissions(
        to: PresencePermissions, from: PresencePermissions, etag: string
    ): Promise<ZncSuccessResponse<{}>> {
        throw new Error('Not supported in ZncProxyApi');
    }

    async getWebServiceToken(id: string) {
        const response = await this.fetch<{token: WebServiceToken}>('/webservice/' + id + '/token');
        return {status: ZncStatus.OK as const, result: response.token, correlationId: ''};
    }

    async getToken(token: string, user: NintendoAccountUser): Promise<ZncSuccessResponse<WebServiceToken>> {
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
