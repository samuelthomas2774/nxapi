import { Cookie, fetch, FormData, getSetCookies } from 'undici';
import { v4 as uuidgen } from 'uuid';
import { WebServiceToken } from './coral-types.js';
import { NintendoAccountUser } from './na.js';
import { defineResponse, ErrorResponse } from './util.js';
import { CoralApiInterface } from './coral.js';
import { ActiveFestivals, CoopResult, CoopResults, CoopSchedules, HeroRecords, LeagueMatchRankings, NicknameAndIcons, PastFestivals, Records, Result, Results, Schedules, ShareResponse, ShopMerchandises, Stages, Timeline, WebServiceError, XPowerRankingRecords, XPowerRankingSummary } from './splatnet2-types.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { toSeasonId, Rule as XPowerRankingRule, Season } from './splatnet2-xrank.js';

const debug = createDebug('nxapi:api:splatnet2');

export const SPLATNET2_WEBSERVICE_ID = 5741031244955648;
export const SPLATNET2_WEBSERVICE_URL = 'https://app.splatoon2.nintendo.net/';
export const SPLATNET2_WEBSERVICE_USERAGENT = 'Mozilla/5.0 (Linux; Android 8.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.125 Mobile Safari/537.36';

const SPLATNET2_URL = SPLATNET2_WEBSERVICE_URL + 'api';

const XPOWERRANKING_SEASON = /^(\d{2})(\d{2})01T00_(\d{2})(\d{2})01T00$/;
const LEAGUE_ID = /^(\d{2})(\d{2})(\d{2})(\d{2})(T|P)$/;

export const updateIksmSessionLastUsed: {
    handler?: ((iksm_session: string) => void);
} = {};

export default class SplatNet2Api {
    protected _session_expired = false;

    protected constructor(
        public iksm_session: string,
        public unique_id: string,
        public useragent: string,
    ) {}

    async fetch<T extends object>(url: string, method = 'GET', body?: string | FormData, headers?: object) {
        if (this._session_expired) {
            throw new Error('Session expired');
        }

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(SPLATNET2_URL + url, {
            method,
            headers: Object.assign({
                'User-Agent': this.useragent,
                'Cookie': 'iksm_session=' + encodeURIComponent(this.iksm_session),
                'Accept': '*/*',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'Referrer': 'https://app.splatoon2.nintendo.net/home',
                'X-Requested-With': 'XMLHttpRequest',
                // 'X-Timezone-Offset': (new Date()).getTimezoneOffset().toString(),
                'X-Timezone-Offset': '0',
                'X-Unique-Id': this.unique_id,
            }, headers),
            body,
            signal,
        }).finally(cancel);

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status === 401) {
            this._session_expired = true;
        }

        if (response.status !== 200) {
            throw await SplatNet2ErrorResponse.fromResponse(response, '[splatnet2] Non-200 status code');
        }

        updateIksmSessionLastUsed.handler?.call(null, this.iksm_session);

        const data = await response.json() as T | WebServiceError;

        if ('code' in data) {
            throw new SplatNet2ErrorResponse('[splatnet2] ' + data.message, response, data);
        }

        return defineResponse(data, response);
    }

    async getRecords() {
        return this.fetch<Records>('/records');
    }

    async getStages() {
        return this.fetch<Stages>('/data/stages');
    }

    async getActiveFestivals() {
        return this.fetch<ActiveFestivals>('/festivals/active');
    }

    async getTimeline() {
        return this.fetch<Timeline>('/timeline');
    }

    async getUserNicknameAndIcon(ids: string[]) {
        return this.fetch<NicknameAndIcons>('/nickname_and_icon?' +
            ids.map(id => 'id=' + encodeURIComponent(id)).join('&'));
    }

    async getSchedules() {
        return this.fetch<Schedules>('/schedules');
    }

    async getHeroRecords() {
        return this.fetch<HeroRecords>('/records/hero');
    }

    async getXPowerRankingSummary(season: string | Date | Season) {
        if (typeof season === 'object' && 'start' in season) {
            season = season.id;
        }

        if (season instanceof Date) {
            season = toSeasonId(season.getUTCFullYear(), season.getUTCMonth() + 1);
        }

        let match = season.match(/^(\d+)-(\d{2})$/);
        if (match) {
            season = toSeasonId(parseInt(match[1]), parseInt(match[2]));
        }

        if (!season.match(XPOWERRANKING_SEASON)) {
            throw new Error('Invalid season ID');
        }

        return this.fetch<XPowerRankingSummary>('/x_power_ranking/' + season + '/summary');
    }

    async getXPowerRankingLeaderboard(season: string | Date | Season, rule: XPowerRankingRule, page: number = 1) {
        if (typeof season === 'object' && 'start' in season) {
            season = season.id;
        }

        if (season instanceof Date) {
            season = toSeasonId(season.getUTCFullYear(), season.getUTCMonth() + 1);
        }

        let match = season.match(/^(\d+)-(\d{2})$/);
        if (match) {
            season = toSeasonId(parseInt(match[1]), parseInt(match[2]));
        }

        if (!season.match(XPOWERRANKING_SEASON)) {
            throw new Error('Invalid season ID');
        }

        return this.fetch<XPowerRankingRecords>('/x_power_ranking/' + season + '/' + rule + '?page=' + page);
    }

    async getPastFestivals() {
        return this.fetch<PastFestivals>('/festivals/pasts');
    }

    async getLeagueMatchRanking(id: string, region: LeagueRegion): Promise<LeagueMatchRankings>
    async getLeagueMatchRanking(date: Date, type: LeagueType, region: LeagueRegion): Promise<LeagueMatchRankings>
    async getLeagueMatchRanking(id: string | Date, arg1: LeagueRegion | LeagueType, arg2?: LeagueRegion) {
        const region = id instanceof Date ? arg2! : arg1 as LeagueRegion;

        if (id instanceof Date) {
            id = toLeagueId(id, arg1 as LeagueType);
        }

        if (!id.match(LEAGUE_ID)) {
            throw new Error('Invalid league ID');
        }

        return this.fetch<LeagueMatchRankings>('/league_match_ranking/' + id + '/' + region);
    }

    async getResults() {
        return this.fetch<Results>('/results');
    }

    async getResult(id: string | number) {
        return this.fetch<Result>('/results/' + id);
    }

    async getCoopResults() {
        return this.fetch<CoopResults>('/coop_results');
    }

    async getCoopResult(id: number) {
        return this.fetch<CoopResult>('/coop_results/' + id);
    }

    async getCoopSchedules() {
        return this.fetch<CoopSchedules>('/coop_schedules');
    }

    async getShopMerchandises() {
        return this.fetch<ShopMerchandises>('/onlineshop/merchandises');
    }

    async shareProfile(stage: string, colour: ShareColour) {
        const boundary = uuidgen();

        const data = `--${boundary}
Content-Disposition: form-data; name="stage"

${stage}
--${boundary}
Content-Disposition: form-data; name="color"

${colour}
--${boundary}--
`.replace(/\r?\n/g, '\r\n');

        return this.fetch<ShareResponse>('/share/profile', 'POST', data, {
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Referer': 'https://app.splatoon2.nintendo.net/home',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.splatoon2.nintendo.net',
        });
    }

    async shareChallenge(id: string, season: 1 | 2 = 1) {
        const url = '/share/challenges' + (season === 2 ? '_season_2' : '') + '/' + id;

        return this.fetch<ShareResponse>(url, 'POST', '', {
            'Referer': 'https://app.splatoon2.nintendo.net/records/challenge' + (season === 2 ? '_season_2' : ''),
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.splatoon2.nintendo.net',
        });
    }

    async shareResultsSummary() {
        return this.fetch<ShareResponse>('/share/results/summary', 'POST', '', {
            'Referer': 'https://app.splatoon2.nintendo.net/results',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.splatoon2.nintendo.net',
        });
    }

    async shareResult(id: string | number) {
        return this.fetch<ShareResponse>('/share/results/' + id, 'POST', '', {
            'Referer': 'https://app.splatoon2.nintendo.net/results/' + id,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.splatoon2.nintendo.net',
        });
    }

    static async createWithCoral(coral: CoralApiInterface, user: NintendoAccountUser) {
        const data = await this.loginWithCoral(coral, user);
        return {splatnet: this.createWithSavedToken(data), data};
    }

    static createWithSavedToken(data: SplatNet2AuthData) {
        return new this(
            data.iksm_session,
            data.user_id,
            data.useragent,
        );
    }

    static createWithCliTokenData(data: SplatNet2CliTokenData) {
        return new this(
            data.iksm_session,
            data.user_id,
            SPLATNET2_WEBSERVICE_USERAGENT,
        );
    }

    static createWithIksmSession(iksm_session: string, unique_id: string) {
        return new this(
            iksm_session,
            unique_id,
            SPLATNET2_WEBSERVICE_USERAGENT,
        );
    }

    static async loginWithCoral(coral: CoralApiInterface, user: NintendoAccountUser) {
        const webserviceToken = await coral.getWebServiceToken(SPLATNET2_WEBSERVICE_ID);

        return this.loginWithWebServiceToken(webserviceToken, user);
    }

    static async loginWithWebServiceToken(
        webserviceToken: WebServiceToken, user: NintendoAccountUser
    ): Promise<SplatNet2AuthData> {
        const url = new URL(SPLATNET2_WEBSERVICE_URL);
        url.search = new URLSearchParams({
            lang: user.language,
            na_country: user.country,
            na_lang: user.language,
        }).toString();

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(url.toString(), {
            headers: {
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': SPLATNET2_WEBSERVICE_USERAGENT,
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

        if (response.status !== 200) {
            throw await SplatNet2ErrorResponse.fromResponse(response, '[splatnet2] Non-200 status code');
        }

        const body = await response.text();

        const cookies = getSetCookies(response.headers);
        const iksm_session = cookies.find(c => c.name === 'iksm_session');

        if (!iksm_session) {
            throw new SplatNet2ErrorResponse('[splatnet2] Response didn\'t include iksm_session cookie', response, body);
        }

        const expires_at: number = (iksm_session.expires as Date)?.getTime() ?? Date.now() + 24 * 60 * 60 * 1000;

        debug('iksm_session %s, expires %s', iksm_session.value.replace(/^(.{6}).*/, '$1****'), iksm_session.expires);

        const ml = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+lang=(?:"([^"]*)"|([^\s>]*))/i);
        const mr = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-region=(?:"([^"]*)"|([^\s>]*))/i);
        const mu = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-unique-id=(?:"([^"]*)"|([^\s>]*))/i);
        const mn = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-nsa-id=(?:"([^"]*)"|([^\s>]*))/i);
        const [language, region, user_id, nsa_id] = [ml, mr, mu, mn].map(m => m?.[1] || m?.[2] || null);

        if (!language) throw new ErrorResponse('[splatnet2] Invalid language in response', response, body);
        if (!region) throw new ErrorResponse('[splatnet2] Invalid region in response', response, body);
        if (!user_id) throw new ErrorResponse('[splatnet2] Invalid unique player ID in response', response, body);
        if (!nsa_id) throw new ErrorResponse('[splatnet2] Invalid NSA ID in response', response, body);

        debug('SplatNet 2 user', {
            language,
            region,
            user_id: user_id?.replace(/^(.{6}).*/, '$1****'),
            nsa_id: nsa_id?.replace(/^(.{6}).*/, '$1****'),
        });

        return {
            webserviceToken,
            url: url.toString(),
            cookies,
            body,
            language,
            region,
            user_id,
            nsa_id,

            iksm_session: iksm_session.value,
            expires_at,
            useragent: SPLATNET2_WEBSERVICE_USERAGENT,
        };
    }
}

export class SplatNet2ErrorResponse extends ErrorResponse<WebServiceError> {}

export interface SplatNet2AuthData {
    webserviceToken: WebServiceToken;
    url: string;
    cookies: string | Cookie[];
    body: string;

    language: string;
    region: string;
    /** Splatoon 2 player ID aka. unique_id */
    user_id: string;
    nsa_id: string;

    iksm_session: string;
    expires_at: number;
    useragent: string;
}

export interface SplatNet2CliTokenData {
    iksm_session: string;
    language: string;
    region: string;
    user_id: string;
    nsa_id: string;
}

export function toLeagueId(date: Date, type: LeagueType) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = Math.floor(date.getUTCHours() / 2) * 2;

    if (year < 2000) throw new Error('Invalid league ID');
    if (year >= 2100) throw new Error('Invalid league ID');

    return ('' + (year - 2000)).padStart(2, '0') +
        ('' + month).padStart(2, '0') +
        ('' + day).padStart(2, '0') +
        ('' + hour).padStart(2, '0') +
        type;
}

export enum LeagueType {
    TEAM = 'T',
    PAIR = 'P',
}

export enum LeagueRegion {
    ALL_REGIONS = 'ALL',
    JAPAN = 'JP',
    NA_AU_NZ = 'US',
    EUROPE = 'EU',
}

export enum ShareColour {
    PINK = 'pink',
    GREEN = 'green',
    YELLOW = 'yellow',
    PURPLE = 'purple',
    BLUE = 'blue',
    SUN_YELLOW = 'sun-yellow',
}
