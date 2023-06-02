import fetch, { Response } from 'node-fetch';
import { getNintendoAccountToken, getNintendoAccountUser, NintendoAccountToken, NintendoAccountUser } from './na.js';
import { defineResponse, ErrorResponse, HasResponse } from './util.js';
import { DailySummaries, Devices, MonthlySummaries, MonthlySummary, MoonError, ParentalControlSettingState, SmartDevices, User } from './moon-types.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';

const debug = createDebug('nxapi:api:moon');

const MOON_URL = 'https://api-lp1.pctl.srv.nintendo.net/moon';
export const ZNMA_CLIENT_ID = '54789befb391a838';

const ZNMA_VERSION = '1.17.0';
const ZNMA_BUILD = '261';
const ZNMA_USER_AGENT = 'moon_ANDROID/' + ZNMA_VERSION + ' (com.nintendo.znma; build:' + ZNMA_BUILD +
    '; ANDROID 26)';

export default class MoonApi {
    onTokenExpired: ((data?: MoonError, res?: Response) => Promise<MoonAuthData | PartialMoonAuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;
    protected _token_expired = false;

    protected constructor(
        public token: string,
        public naId: string,
        readonly znma_version = ZNMA_VERSION,
        readonly znma_build = ZNMA_BUILD,
        readonly znma_useragent = ZNMA_USER_AGENT,
    ) {}

    async fetch<T extends object>(
        url: string, method = 'GET', body?: string, headers?: object,
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
        const response = await fetch(MOON_URL + url, {
            method,
            headers: Object.assign({
                'Authorization': 'Bearer ' + this.token,
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json; charset=utf-8',
                'X-Moon-App-Id': 'com.nintendo.znma',
                'X-Moon-Os': 'ANDROID',
                'X-Moon-Os-Version': '26',
                'X-Moon-Model': '',
                'X-Moon-TimeZone': 'Europe/London',
                'X-Moon-Os-Language': 'en-GB',
                'X-Moon-App-Language': 'en-GB',
                'X-Moon-App-Display-Version': this.znma_version,
                'X-Moon-App-Internal-Version': this.znma_build,
                'User-Agent': this.znma_useragent,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status === 401 && _autoRenewToken && !_attempt && this.onTokenExpired) {
            this._token_expired = true;
            const data = await response.json() as MoonError;

            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, data, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _autoRenewToken, _attempt + 1);
        }

        if (response.status !== 200) {
            throw new ErrorResponse('[moon] Non-200 status code', response, await response.text());
        }

        const data = await response.json() as T | MoonError;

        if ('errorCode' in data) {
            throw new ErrorResponse('[moon] ' + data.title, response, data);
        }

        return defineResponse(data, response);
    }

    async getUser() {
        return this.fetch<User>('/v1/users/' + this.naId);
    }

    async getSmartDevices() {
        return this.fetch<SmartDevices>('/v1/users/' + this.naId + '/smart_devices');
    }

    async getDevices() {
        return this.fetch<Devices>('/v1/users/' + this.naId + '/devices');
    }

    async getDailySummaries(id: string) {
        return this.fetch<DailySummaries>('/v1/devices/' + id + '/daily_summaries');
    }

    async getMonthlySummaries(id: string) {
        return this.fetch<MonthlySummaries>('/v1/devices/' + id + '/monthly_summaries');
    }

    async getMonthlySummary(id: string, month: string) {
        return this.fetch<MonthlySummary>('/v1/devices/' + id + '/monthly_summaries/' + month);
    }

    async getParentalControlSettingState(id: string) {
        return this.fetch<ParentalControlSettingState>('/v1/devices/' + id + '/parental_control_setting_state');
    }

    async renewToken(token: string) {
        const data = await MoonApi.loginWithSessionToken(token);
        this.setTokenWithSavedToken(data);
        return data;
    }

    private setTokenWithSavedToken(data: MoonAuthData | PartialMoonAuthData) {
        this.token = data.nintendoAccountToken.access_token!;
        if ('user' in data) this.naId = data.user.id;
        this._token_expired = false;
    }

    static async createWithSessionToken(token: string) {
        const data = await this.loginWithSessionToken(token);
        return {moon: this.createWithSavedToken(data), data};
    }

    static createWithSavedToken(data: MoonAuthData) {
        return new this(
            data.nintendoAccountToken.access_token!,
            data.user.id,
            data.znma_version,
            data.znma_build,
            data.znma_useragent,
        );
    }

    static async loginWithSessionToken(token: string): Promise<MoonAuthData> {
        const { default: { moon: config } } = await import('../common/remote-config.js');

        if (!config) throw new Error('Remote configuration prevents Moon authentication');

        const znma_useragent = 'moon_ANDROID/' + config.znma_version +
            ' (com.nintendo.znma; build:' + config.znma_build + '; ANDROID 26)';

        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNMA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser(nintendoAccountToken);

        return {
            nintendoAccountToken,
            user,
            znma_version: config.znma_version,
            znma_build: config.znma_build,
            znma_useragent: znma_useragent,
        };
    }
}

export interface MoonAuthData {
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;
    znma_version: string;
    znma_build: string;
    znma_useragent: string;
}
export interface PartialMoonAuthData {
    nintendoAccountToken: NintendoAccountToken;
}
