import fetch from 'node-fetch';
import createDebug from 'debug';
import { WebServiceToken } from './coral-types.js';
import { NintendoAccountUser } from './na.js';
import { defineResponse, ErrorResponse } from './util.js';
import CoralApi from './coral.js';
import { timeoutSignal } from '../util/misc.js';
import { BankaraBattleHistoriesResult, BattleHistoryCurrentPlayerResult, BulletToken, CurrentFestResult, FriendListResult, GraphQLRequest, GraphQLResponse, HistoryRecordResult, HomeResult, LatestBattleHistoriesResult, PrivateBattleHistoriesResult, RegularBattleHistoriesResult, RequestId, SettingResult, StageScheduleResult, VsHistoryDetailResult  } from './splatnet3-types.js';

const debug = createDebug('nxapi:api:splatnet3');

export const SPLATNET3_WEBSERVICE_ID = 4834290508791808;
export const SPLATNET3_WEBSERVICE_URL = 'https://api.lp1.av5ja.srv.nintendo.net';
export const SPLATNET3_WEBSERVICE_USERAGENT = 'Mozilla/5.0 (Linux; Android 8.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.125 Mobile Safari/537.36';

const languages = [
    'de-DE', 'en-GB', 'en-US', 'es-ES', 'es-MX', 'fr-CA',
    'fr-FR', 'it-IT', 'ja-JP', 'ko-KR', 'nl-NL', 'ru-RU',
    'zh-CN', 'zh-TW',
];

const SPLATNET3_URL = SPLATNET3_WEBSERVICE_URL + '/api';

export default class SplatNet3Api {
    protected constructor(
        public bullet_token: string,
        public version: string,
        public language: string,
        public useragent: string,
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string | FormData, headers?: object) {
        const [signal, cancel] = timeoutSignal();
        const response = await fetch(SPLATNET3_URL + url, {
            method,
            headers: Object.assign({
                'User-Agent': this.useragent,
                'Accept': '*/*',
                'Referrer': 'https://api.lp1.av5ja.srv.nintendo.net/',
                'X-Requested-With': 'XMLHttpRequest',
                'authorization': 'Bearer ' + this.bullet_token,
                'content-type': 'application/json',
                'X-Web-View-Ver': this.version,
                'Accept-Language': this.language,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status !== 200) {
            throw new ErrorResponse('[splatnet3] Non-200 status code', response, await response.text());
        }

        const data = await response.json() as T;

        return defineResponse(data, response);
    }

    async persistedQuery<T = unknown, V = unknown>(id: string, variables: V) {
        const req: GraphQLRequest<V> = {
            variables,
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: id,
                },
            },
        };

        const data = await this.fetch<GraphQLResponse<T>>('/graphql', 'POST', JSON.stringify(req));

        return data;
    }

    async getHome() {
        return this.persistedQuery<HomeResult>(RequestId.HomeQuery, {});
    }

    async getCurrentFest() {
        return this.persistedQuery<CurrentFestResult>(RequestId.CurrentFestQuery, {});
    }

    async getConfigureAnalytics() {
        return this.persistedQuery(RequestId.ConfigureAnalyticsQuery, {});
    }

    async getSettings() {
        return this.persistedQuery<SettingResult>(RequestId.SettingQuery, {});
    }

    async getFriends() {
        return this.persistedQuery<FriendListResult>(RequestId.FriendListQuery, {});
    }

    async getFriendsRefetch() {
        return this.persistedQuery<FriendListResult>(RequestId.FriendListRefetchQuery, {});
    }

    async getHistoryRecords() {
        return this.persistedQuery<HistoryRecordResult>(RequestId.HistoryRecordQuery, {});
    }

    async getSchedules() {
        return this.persistedQuery<StageScheduleResult>(RequestId.StageScheduleQuery, {});
    }

    async getBattleHistoryCurrentPlayer() {
        return this.persistedQuery<BattleHistoryCurrentPlayerResult>(RequestId.BattleHistoryCurrentPlayerQuery, {});
    }

    async getLatestBattleHistories() {
        return this.persistedQuery<LatestBattleHistoriesResult>(RequestId.LatestBattleHistoriesQuery, {});
    }

    async getRegularBattleHistories() {
        return this.persistedQuery<RegularBattleHistoriesResult>(RequestId.RegularBattleHistoriesQuery, {});
    }

    async getBankaraBattleHistories() {
        return this.persistedQuery<BankaraBattleHistoriesResult>(RequestId.BankaraBattleHistoriesQuery, {});
    }

    async getPrivateBattleHistories() {
        return this.persistedQuery<PrivateBattleHistoriesResult>(RequestId.PrivateBattleHistoriesQuery, {});
    }

    async getBattleHistoryDetail(id: string) {
        return this.persistedQuery<VsHistoryDetailResult>(RequestId.VsHistoryDetailQuery, {
            vsResultId: id,
        });
    }

    async getBattleHistoryDetailPagerRefetch(id: string) {
        return this.persistedQuery<VsHistoryDetailResult>(RequestId.VsHistoryDetailPagerRefetchQuery, {
            vsResultId: id,
        });
    }

    async getCoopHistory() {
        return this.persistedQuery<unknown>(RequestId.CoopHistoryQuery, {});
    }

    static async createWithCoral(nso: CoralApi, user: NintendoAccountUser) {
        const data = await this.loginWithCoral(nso, user);
        return {splatnet: this.createWithSavedToken(data), data};
    }

    static createWithSavedToken(data: SplatNet3AuthData) {
        return new this(
            data.bullet_token.bulletToken,
            data.version,
            data.bullet_token.lang,
            data.useragent,
        );
    }

    static createWithCliTokenData(data: SplatNet3CliTokenData) {
        return new this(
            data.bullet_token,
            data.version,
            data.language,
            SPLATNET3_WEBSERVICE_USERAGENT,
        );
    }

    static async loginWithCoral(nso: CoralApi, user: NintendoAccountUser) {
        const { default: { coral_gws_splatnet3: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents SplatNet 3 authentication');

        const webserviceToken = await nso.getWebServiceToken(SPLATNET3_WEBSERVICE_ID);

        return this.loginWithWebServiceToken(webserviceToken, user);
    }

    static async loginWithWebServiceToken(
        webserviceToken: WebServiceToken, user: NintendoAccountUser
    ): Promise<SplatNet3AuthData> {
        const { default: { coral_gws_splatnet3: config } } = await import('../common/remote-config.js');
        if (!config) throw new Error('Remote configuration prevents SplatNet 3 authentication');

        const language = languages.includes(user.language) ? user.language : 'en-GB';
        const version = config.app_ver ?? config.version + '-' + config.revision.substr(0, 8);

        const url = new URL(SPLATNET3_WEBSERVICE_URL);
        url.search = new URLSearchParams({
            lang: user.language,
            na_country: user.country,
            na_lang: user.language,
        }).toString();

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(url.toString(), {
            headers: {
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': SPLATNET3_WEBSERVICE_USERAGENT,
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
            throw new ErrorResponse('[splatnet3] Non-200 status code', response, body);
        }

        const cookies = response.headers.get('Set-Cookie');

        const [signal2, cancel2] = timeoutSignal();
        const token_response = await fetch(SPLATNET3_URL + '/bullet_tokens', {
            method: 'POST',
            headers: {
                'User-Agent': SPLATNET3_WEBSERVICE_USERAGENT,
                'Accept': '*/*',
                'Referrer': 'https://api.lp1.av5ja.srv.nintendo.net/',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'X-Web-View-Ver': version,
                'X-NACOUNTRY': user.country,
                'Accept-Language': language,
                'X-GameWebToken': webserviceToken.accessToken,
            },
            body: '',
            signal: signal2,
        }).finally(cancel2);

        debug('fetch %s %s, response %s', 'POST', '/bullet_tokens', response.status);

        if (token_response.status === 401) {
            throw new ErrorResponse('[splatnet3] ERROR_INVALID_GAME_WEB_TOKEN', token_response, await token_response.text());
        }
        if (token_response.status === 403) {
            throw new ErrorResponse('[splatnet3] ERROR_OBSOLETE_VERSION', token_response, await token_response.text());
        }
        if (token_response.status === 204) {
            throw new ErrorResponse('[splatnet3] USER_NOT_REGISTERED', token_response, await token_response.text());
        }
        if (token_response.status !== 201) {
            throw new ErrorResponse('[splatnet3] Non-201 status code', token_response, await token_response.text());
        }

        const bullet_token = await token_response.json() as BulletToken;
        const expires_at = Date.now() + (2 * 60 * 60 * 1000); // ??

        return {
            webserviceToken,
            url: url.toString(),
            cookies,
            body,

            language,
            country: user.country,
            version,

            bullet_token,
            expires_at,
            useragent: SPLATNET3_WEBSERVICE_USERAGENT,
        };
    }
}

export interface SplatNet3AuthData {
    webserviceToken: WebServiceToken;
    url: string;
    cookies: string | null;
    body: string;

    language: string;
    country: string;
    version: string;

    bullet_token: BulletToken;
    expires_at: number;
    useragent: string;
}

export interface SplatNet3CliTokenData {
    bullet_token: string;
    expires_at: number;
    language: string;
    version: string;
}
