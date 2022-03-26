import fetch from 'node-fetch';
import createDebug from 'debug';
import { getNintendoAccountToken, getNintendoAccountUser } from './na.js';
import { ErrorResponse } from './util.js';
import { DailySummaries, Devices, MonthlySummaries, MonthlySummary, MoonError, SmartDevices, User } from './moon-types.js';

const debug = createDebug('api:moon');

const MOON_URL = 'https://api-lp1.pctl.srv.nintendo.net/moon';
export const ZNMA_CLIENT_ID = '54789befb391a838';

export default class MoonApi {
    constructor(
        public token: string,
        public naId: string
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const response = await fetch(MOON_URL + url, {
            method: method,
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
                'X-Moon-App-Display-Version': '1.16.0',
                'X-Moon-App-Internal-Version': '247',
                'User-Agent': 'moon_ANDROID/1.16.0 (com.nintendo.znma; build:247; ANDROID 26)',
            }, headers),
            body: body,
        });

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
        return this.fetch<unknown>('/v1/devices/' + id + '/parental_control_setting_state');
    }

    static async createWithSessionToken(token: string) {
        const data = await this.loginWithSessionToken(token);

        return {
            moon: new this(data.nintendoAccountToken.access_token!, data.user.id),
            data,
        };
    }

    async renewToken(token: string) {
        const data = await MoonApi.loginWithSessionToken(token);

        this.token = data.nintendoAccountToken.access_token!;
        this.naId = data.user.id;

        return data;
    }

    static async loginWithSessionToken(token: string) {
        // Nintendo Account token
        const nintendoAccountToken = await getNintendoAccountToken(token, ZNMA_CLIENT_ID);

        // Nintendo Account user data
        const user = await getNintendoAccountUser(nintendoAccountToken);

        return {
            nintendoAccountToken,
            user,
        };
    }
}
