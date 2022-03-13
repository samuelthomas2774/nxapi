import fetch from 'node-fetch';
import createDebug from 'debug';
import { ActiveEvent, Announcement, CurrentUser, Friend, WebService, WebServiceToken } from './znc-types.js';
import { ErrorResponse } from './util.js';
import ZncApi from './znc.js';
import { SavedToken } from '../util.js';

const debug = createDebug('api:znc-proxy');

export default class ZncProxyApi implements ZncApi {
    constructor(
        private url: string,
        // ZncApi uses the NSO token (valid for a few hours)
        // ZncProxyApi uses the Nintendo Account session token (valid for two years)
        public token: string
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const response = await fetch(this.url + url, {
            method: method,
            headers: Object.assign({
                'Authorization': 'na ' + this.token,
            }, headers),
            body: body,
        });

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status !== 200) {
            throw new ErrorResponse('[zncproxy] Unknown error', response);
        }

        const data = await response.json() as T;

        return data;
    }

    async getAnnouncements() {
        const response = await this.fetch<{announcements: Announcement[]}>('/announcements');
        return {status: 0 as const, result: response.announcements, correlationId: ''};
    }

    async getFriendList() {
        const response = await this.fetch<{friends: Friend[]}>('/friends');
        return {status: 0 as const, result: response, correlationId: ''};
    }

    async getWebServices() {
        const response = await this.fetch<{webservices: WebService[]}>('/webservices');
        return {status: 0 as const, result: response.webservices, correlationId: ''};
    }

    async getActiveEvent() {
        const response = await this.fetch<{activeevent: ActiveEvent}>('/activeevent');
        return {status: 0 as const, result: response.activeevent, correlationId: ''};
    }

    async getCurrentUser() {
        const response = await this.fetch<{user: CurrentUser}>('/user');
        return {status: 0 as const, result: response.user, correlationId: ''};
    }

    async getWebServiceToken(id: string) {
        const response = await this.fetch<{token: WebServiceToken}>('/webservice/' + id + '/token');
        return {status: 0 as const, result: response.token, correlationId: ''};
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
