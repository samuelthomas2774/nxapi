import fetch from 'node-fetch';
import createDebug from 'debug';
import { v4 as uuidgen } from 'uuid';
import { WebServiceToken } from './znc-types.js';
import { NintendoAccountUser } from './na.js';
import { ErrorResponse } from './util.js';
import ZncApi from './znc.js';
import { ActiveFestivals, CoopResult, CoopResults, CoopSchedules, HeroRecords, NicknameAndIcons, PastFestivals, Records, Result, Results, Schedules, ShareResponse, ShopMerchandises, Stages, Timeline, WebServiceError, XPowerRankingSummary } from './splatnet2-types.js';
import { updateIksmSessionLastUsed } from '../cli/splatnet2/util.js';

const debug = createDebug('api:splatnet2');

export const SPLATNET2_WEBSERVICE_ID = '5741031244955648';
export const SPLATNET2_WEBSERVICE_URL = 'https://app.splatoon2.nintendo.net/';
export const SPLATNET2_WEBSERVICE_USERAGENT = 'Mozilla/5.0 (Linux; Android 8.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.125 Mobile Safari/537.36';

const SPLATNET2_URL = SPLATNET2_WEBSERVICE_URL + 'api';

const XPOWERRANKING_SEASON = /^(\d{2})(\d{2})01T00_(\d{2})(\d{2})01T00$/;
const LEAGUE_ID = /^(\d{2})(\d{2})(\d{2})(\d{2})(T|P)$/;

export default class SplatNet2Api {
    constructor(
        public iksm_session: string,
        public useragent: string
    ) {}

    async fetch<T = unknown>(url: string, method = 'GET', body?: string | FormData, headers?: object) {
        const response = await fetch(SPLATNET2_URL + url, {
            method: method,
            headers: Object.assign({
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': this.useragent,
                'Cookie': 'iksm_session=' + encodeURIComponent(this.iksm_session),
                'dnt': '1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'X-Requested-With': 'com.nintendo.znca',
            }, headers),
            body: body,
        });

        debug('fetch %s %s, response %s', method, url, response.status);

        if (response.status !== 200) {
            const data = response.headers.get('Content-Type')?.match(/\bapplication\/json\b/i) ?
                await response.json() : await response.text();

            throw new ErrorResponse('[splatnet2] Unknown error', response, data);
        }

        updateIksmSessionLastUsed(this.iksm_session);

        const data = await response.json() as T | WebServiceError;

        if ('code' in data) {
            throw new ErrorResponse('[splatnet2] ' + data.message, response, data);
        }

        return data;
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

    async getXPowerRankingSummary(season: string | Date) {
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

    async getXPowerRankingLeaderboard(season: string | Date, rule: XPowerRankingRule, page: number = 1) {
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

        return this.fetch<unknown>('/x_power_ranking/' + season + '/' + rule + '?page=' + page);
    }

    async getPastFestivals() {
        return this.fetch<PastFestivals>('/festivals/pasts');
    }

    async getLeagueMatchRanking(id: string, region: LeagueRegion) {
        if (!id.match(LEAGUE_ID)) {
            throw new Error('Invalid league ID');
        }

        return this.fetch<PastFestivals>('/league_match_ranking/' + id + '/' + region);
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

    static async createWithZnc(nso: ZncApi, user: NintendoAccountUser) {
        const data = await this.loginWithZnc(nso, user);

        return {
            splatnet: new this(data.iksm_session, data.useragent),
            data,
        };
    }

    static async loginWithZnc(nso: ZncApi, user: NintendoAccountUser) {
        const webserviceToken = await nso.getWebServiceToken(SPLATNET2_WEBSERVICE_ID);

        return this.loginWithWebServiceToken(webserviceToken.result, user);
    }

    static async loginWithWebServiceToken(webserviceToken: WebServiceToken, user: NintendoAccountUser) {
        const url = new URL(SPLATNET2_WEBSERVICE_URL);
        url.search = new URLSearchParams({
            lang: user.language,
            na_country: user.country,
            na_lang: user.language,
        }).toString();

        const response = await fetch(url.toString(), {
            headers: {
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': SPLATNET2_WEBSERVICE_USERAGENT,
                'x-gamewebtoken': webserviceToken.accessToken,
                'dnt': '1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-GB,en-US;q=0.8',
                'X-Requested-With': 'com.nintendo.znca',
            },
        });

        debug('fetch %s %s, response %s', 'GET', url, response.status);

        if (response.status !== 200) {
            throw new ErrorResponse('Unknown error', response);
        }

        const cookies = response.headers.get('Set-Cookie');
        const match = cookies?.match(/\biksm_session=([^;]*)(;(\s*((?!expires)[a-z]+=([^;]*));?)*(\s*(expires=([^;]*));?)?|$)/i);

        if (!match) {
            throw new ErrorResponse('Response didn\'t include iksm_session cookie', response);
        }

        const iksm_session = decodeURIComponent(match[1]);
        // Nintendo sets the expires field to an invalid timestamp - browsers don't care but Data.parse does
        const expires = decodeURIComponent(match[8] || '')
            .replace(/(\b)(\d{1,2})-([a-z]{3})-(\d{4})(\b)/gi, '$1$2 $3 $4$5');

        debug('iksm_session %s, expires %s', iksm_session, expires);

        const expires_at = expires ? Date.parse(expires) : Date.now() + 24 * 60 * 60 * 1000;

        const body = await response.text();

        const ml = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+lang=(?:"([^"]*)"|([^\s>]*))/i);
        const mr = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-region=(?:"([^"]*)"|([^\s>]*))/i);
        const mu = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-unique-id=(?:"([^"]*)"|([^\s>]*))/i);
        const mn = body.match(/<html(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|[^\s>]*))?)*\s+data-nsa-id=(?:"([^"]*)"|([^\s>]*))/i);
        const [language, region, user_id, nsa_id] = [ml, mr, mu, mn].map(m => m?.[1] || m?.[2] || null);

        debug('SplatNet 2 user', {language, region, user_id, nsa_id});

        return {
            webserviceToken,
            url: url.toString(),
            cookies: cookies!,
            body,
            language,
            region,
            user_id,
            nsa_id,

            iksm_session,
            expires_at,
            useragent: SPLATNET2_WEBSERVICE_USERAGENT,
        };
    }
}

export function toSeasonId(year: number, month: number) {
    const nextyear = month === 12 ? year + 1 : year;
    const nextmonth = month === 12 ? 1 : month + 1;

    if (year < 2000) throw new Error('Invalid season ID');
    if (nextyear >= 2100) throw new Error('Invalid season ID');

    return ('' + (year - 2000)).padStart(2, '0') +
        ('' + month).padStart(2, '0') +
        '01T00_' +
        ('' + (nextyear - 2000)).padStart(2, '0') +
        ('' + nextmonth).padStart(2, '0') +
        '01T00';
}

export enum XPowerRankingRule {
    SPLAT_ZONES = 'splat_zones',
    TOWER_CONTROL = 'tower_control',
    RAINMAKER = 'rainmaker',
    CLAM_BLITZ = 'clam_blitz',
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
