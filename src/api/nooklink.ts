import fetch, { Response } from 'node-fetch';
import { WebServiceToken } from './coral-types.js';
import { NintendoAccountUser } from './na.js';
import { defineResponse, ErrorResponse, HasResponse } from './util.js';
import { CoralApiInterface } from './coral.js';
import { WebServiceError, Users, AuthToken, UserProfile, Newspapers, Newspaper, Emoticons, Reaction, IslandProfile } from './nooklink-types.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';

const debug = createDebug('nxapi:api:nooklink');

export const NOOKLINK_WEBSERVICE_ID = 4953919198265344;
export const NOOKLINK_WEBSERVICE_URL = 'https://web.sd.lp1.acbaa.srv.nintendo.net';
export const NOOKLINK_WEBSERVICE_USERAGENT = 'Mozilla/5.0 (Linux; Android 8.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.125 Mobile Safari/537.36';

const NOOKLINK_URL = NOOKLINK_WEBSERVICE_URL + '/api';
const BLANCO_VERSION = '2.1.1';

export default class NooklinkApi {
    onTokenExpired: ((data?: WebServiceError, res?: Response) => Promise<NooklinkAuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;
    protected _token_expired = false;

    protected constructor(
        public gtoken: string,
        public useragent: string,
        readonly client_version = BLANCO_VERSION,
    ) {}

    async fetch<T extends object>(
        url: string, method = 'GET', body?: string | FormData, headers?: object,
        /** @internal */ _autoRenewToken = true,
        /** @internal */ _attempt = 0,
    ): Promise<HasResponse<T, Response>> {
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
        const response = await fetch(NOOKLINK_URL + url, {
            method,
            headers: Object.assign({
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': this.useragent,
                'Cookie': '_gtoken=' + encodeURIComponent(this.gtoken),
                'dnt': '1',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'Origin': 'https://web.sd.lp1.acbaa.srv.nintendo.net',
                'Content-Type': 'application/json',
                'X-Blanco-Version': this.client_version,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status === 401 && _autoRenewToken && !_attempt && this.onTokenExpired) {
            this._token_expired = true;
            const data = await response.json() as WebServiceError;

            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, data, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _autoRenewToken, _attempt + 1);
        }

        if (response.status !== 200 && response.status !== 201) {
            throw new ErrorResponse('[nooklink] Non-200/201 status code', response, await response.text());
        }

        const data = await response.json() as T | WebServiceError;

        if ('code' in data) {
            throw new ErrorResponse<WebServiceError>('[nooklink] Error ' + data.code, response, data);
        }

        return defineResponse(data, response);
    }

    async getUsers() {
        return this.fetch<Users>('/sd/v1/users');
    }

    async getAuthToken(user_id: string) {
        return this.fetch<AuthToken>('/sd/v1/auth_token', 'POST', JSON.stringify({
            userId: user_id,
        }));
    }

    async createUserClient(user_id: string) {
        return NooklinkUserApi._createWithNooklinkApi(this, user_id);
    }

    async renewTokenWithCoral(coral: CoralApiInterface, user: NintendoAccountUser) {
        const data = await NooklinkApi.loginWithCoral(coral, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    async renewTokenWithWebServiceToken(webserviceToken: WebServiceToken, user: NintendoAccountUser) {
        const data = await NooklinkApi.loginWithWebServiceToken(webserviceToken, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    private setTokenWithSavedToken(data: NooklinkAuthData) {
        this.gtoken = data.gtoken;
        this._token_expired = false;
    }

    static async createWithCoral(coral: CoralApiInterface, user: NintendoAccountUser) {
        const data = await this.loginWithCoral(coral, user);
        return {nooklink: this.createWithSavedToken(data), data};
    }

    static createWithSavedToken(data: NooklinkAuthData) {
        return new this(data.gtoken, data.useragent);
    }

    static async loginWithCoral(coral: CoralApiInterface, user: NintendoAccountUser) {
        const { default: { coral_gws_nooklink: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents NookLink authentication');

        const webserviceToken = await coral.getWebServiceToken(NOOKLINK_WEBSERVICE_ID);

        return this.loginWithWebServiceToken(webserviceToken, user);
    }

    static async loginWithWebServiceToken(
        webserviceToken: WebServiceToken, user: NintendoAccountUser
    ): Promise<NooklinkAuthData> {
        const { default: { coral_gws_nooklink: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents NookLink authentication');

        const url = new URL(NOOKLINK_WEBSERVICE_URL);
        url.search = new URLSearchParams({
            lang: user.language,
            na_country: user.country,
            na_lang: user.language,
        }).toString();

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(url.toString(), {
            headers: {
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': NOOKLINK_WEBSERVICE_USERAGENT,
                'x-appcolorscheme': 'DARK',
                'x-gamewebtoken': webserviceToken.accessToken,
                'dnt': '1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'X-Requested-With': 'com.nintendo.znca',
            },
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', 'GET', url, response.status);

        const body = await response.text();

        if (response.status !== 200) {
            throw new ErrorResponse('[nooklink] Non-200 status code', response, body);
        }

        const cookies = response.headers.get('Set-Cookie');
        const match = cookies?.match(/\b_gtoken=([^;]*)(;(\s*((?!expires)[a-z]+=([^;]*));?)*(\s*(expires=([^;]*));?)?|$)/i);

        if (!match) {
            throw new ErrorResponse('[nooklink] Response didn\'t include _gtoken cookie', response, body);
        }

        const gtoken = decodeURIComponent(match[1]);
        const expires = decodeURIComponent(match[8] || '')
            .replace(/(\b)(\d{1,2})-([a-z]{3})-(\d{4})(\b)/gi, '$1$2 $3 $4$5');

        debug('_gtoken %s, expires %s', gtoken, expires);

        const expires_at = expires ? Date.parse(expires) : Date.now() + webserviceToken.expiresIn * 1000;

        return {
            webserviceToken,
            url: url.toString(),
            cookies: cookies!,
            body,

            gtoken,
            expires_at,
            useragent: NOOKLINK_WEBSERVICE_USERAGENT,
            version: config.blanco_version,
        };
    }
}

export class NooklinkUserApi {
    onTokenExpired: ((data?: WebServiceError, res?: Response) => Promise<NooklinkUserAuthData | PartialNooklinkUserAuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;
    protected _token_expired = false;

    protected constructor(
        public user_id: string,
        public auth_token: string,
        public gtoken: string,
        public useragent: string,
        public language = 'en-GB',
        readonly client_version = BLANCO_VERSION,
    ) {}

    async fetch<T extends object>(
        url: string, method = 'GET', body?: string | FormData, headers?: object,
        /** @internal */ _autoRenewToken = true,
        /** @internal */ _attempt = 0,
    ): Promise<HasResponse<T, Response>> {
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
        const response = await fetch(NOOKLINK_URL + url, {
            method,
            headers: Object.assign({
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': this.useragent,
                'Cookie': '_gtoken=' + encodeURIComponent(this.gtoken),
                'dnt': '1',
                'Accept': 'application/json, text/plain,*/*',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'Origin': 'https://web.sd.lp1.acbaa.srv.nintendo.net',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.auth_token,
                'X-Blanco-Version': this.client_version,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status === 401 && _autoRenewToken && !_attempt && this.onTokenExpired) {
            this._token_expired = true;
            const data = await response.json() as WebServiceError;

            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, data, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _autoRenewToken, _attempt + 1);
        }

        if (response.status !== 200 && response.status !== 201) {
            throw new ErrorResponse('[nooklink] Non-200/201 status code', response, await response.text());
        }

        const data = await response.json() as T | WebServiceError;

        if ('code' in data) {
            throw new ErrorResponse<WebServiceError>('[nooklink] Error ' + data.code, response, data);
        }

        return defineResponse(data, response);
    }

    async getUserProfile(id?: string) {
        return this.fetch<UserProfile>('/sd/v1/users/' + (id ?? this.user_id) + '/profile?language=' + this.language);
    }

    async getIslandProfile(id: string) {
        return this.fetch<IslandProfile>('/sd/v1/lands/' + id + '/profile?language=' + this.language);
    }

    async getNewspapers() {
        return this.fetch<Newspapers>('/sd/v1/newspapers');
    }

    async getNewspaper(key: string) {
        const requestedAt = formatDateTime(new Date());

        return this.fetch<Newspaper>('/sd/v1/newspapers/' + key + '?requestedAt=' + requestedAt + '&language=' + this.language);
    }

    async getLatestNewspaper() {
        const requestedAt = formatDateTime(new Date());

        return this.fetch<Newspaper>('/sd/v1/newspapers/latest?requestedAt=' + requestedAt + '&language=' + this.language);
    }

    async postMessage(body: string, type: MessageType, destination_user_id?: string) {
        return this.fetch('/sd/v1/messages', 'POST', JSON.stringify({
            type,
            body,
            userId: destination_user_id,
        }));
    }

    async keyboard(message: string) {
        return this.postMessage(message, MessageType.KEYBOARD);
    }

    async getEmoticons() {
        return this.fetch<Emoticons>('/sd/v1/emoticons?language=' + this.language);
    }

    async reaction(reaction: Reaction) {
        return this.postMessage(reaction.label, MessageType.EMOTICON);
    }

    async getToken(client: NooklinkApi): Promise<PartialNooklinkUserAuthData> {
        const token = await client.getAuthToken(this.user_id);

        return {
            gtoken: client.gtoken,
            user_id: this.user_id,
            token,
        };
    }

    async renewToken(client: NooklinkApi) {
        const data = await this.getToken(client);
        this.setTokenWithSavedToken(data);
        return data;
    }

    private setTokenWithSavedToken(data: NooklinkUserAuthData | PartialNooklinkUserAuthData) {
        this.user_id = data.user_id;
        this.auth_token = data.token.token;
        this.gtoken = data.gtoken;
        this._token_expired = false;
    }

    /** @internal */
    static async _loginWithNooklinkApi(client: NooklinkApi, user_id: string): Promise<NooklinkUserAuthData> {
        const token = await client.getAuthToken(user_id);

        return {
            gtoken: client.gtoken,
            useragent: client.useragent,
            version: client.client_version,

            user_id,
            token,
            language: 'en-GB',
        };
    }

    /** @internal */
    static async _createWithNooklinkApi(client: NooklinkApi, user_id: string) {
        const data = await this._loginWithNooklinkApi(client, user_id);
        return {nooklinkuser: this.createWithSavedToken(data), data};
    }

    static createWithSavedToken(data: NooklinkUserAuthData) {
        return new NooklinkUserApi(
            data.user_id, data.token.token,
            data.gtoken, data.useragent, data.language, data.version
        );
    }

    static createWithCliTokenData(data: NooklinkUserCliTokenData) {
        return new NooklinkUserApi(
            data.user_id, data.auth_token,
            data.gtoken, NOOKLINK_WEBSERVICE_USERAGENT, data.language, data.version
        );
    }
}

export interface NooklinkAuthData {
    webserviceToken: WebServiceToken;
    url: string;
    cookies: string;
    body: string;

    gtoken: string;
    expires_at: number;
    useragent: string;
    version: string;
}

export interface NooklinkUserAuthData {
    gtoken: string;
    useragent: string;
    version: string;

    user_id: string;
    token: AuthToken;
    language: string;
}
export type PartialNooklinkUserAuthData =
    Pick<NooklinkUserAuthData, 'gtoken' | 'user_id' | 'token'>;

export interface NooklinkUserCliTokenData {
    gtoken: string;
    version: string;

    auth_token: string;
    expires_at: number;
    user_id: string;
    language: string;
}

function formatDateTime(date: Date) {
    return date.getFullYear().toString().padStart(4, '0') + '-' +
        (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
        date.getDate().toString().padStart(2, '0') + ' ' +
        date.getHours().toString().padStart(2, '0') + ':' +
        date.getMinutes().toString().padStart(2, '0');
}

export enum MessageType {
    KEYBOARD = 'keyboard',
    EMOTICON = 'emoticon',
}
