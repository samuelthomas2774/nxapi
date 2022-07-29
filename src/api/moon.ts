import fetch from 'node-fetch';
import createDebug from 'debug';
import { getNintendoAccountToken, getNintendoAccountUser, NintendoAccountToken, NintendoAccountUser } from './na.js';
import { ErrorResponse } from './util.js';
import { DailySummaries, Devices, MonthlySummaries, MonthlySummary, MoonError, ParentalControlSettingState, SmartDevices, User } from './moon-types.js';
import { timeoutSignal } from '../util/misc.js';

const debug = createDebug('nxapi:api:moon');

const MOON_URL = 'https://api-lp1.pctl.srv.nintendo.net/moon';
export const ZNMA_CLIENT_ID = '54789befb391a838';

const ZNMA_VERSION = '1.17.0';
const ZNMA_BUILD = '261';
const ZNMA_USER_AGENT = 'moon_ANDROID/' + ZNMA_VERSION + ' (com.nintendo.znma; build:' + ZNMA_BUILD +
    '; ANDROID 26)';

export default class MoonApi {
    protected constructor(
        public token: string,
        public naId: string,
        readonly znma_version = ZNMA_VERSION,
        readonly znma_build = ZNMA_BUILD,
        readonly znma_useragent = ZNMA_USER_AGENT,
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
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

        const data = await response.json() as T | MoonError;

        if ('errorCode' in data) {
            throw new ErrorResponse('[moon] ' + data.title, response, data);
        }

        return data;
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

        this.token = data.nintendoAccountToken.access_token!;
        this.naId = data.user.id;

        return data;
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
