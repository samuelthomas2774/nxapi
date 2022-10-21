import fetch, { Response } from 'node-fetch';
import createDebug from 'debug';
import { GraphQLRequest, GraphQLResponse, KnownRequestId, MyOutfitInput, RequestId, ResultTypes, VariablesTypes } from 'splatnet3-types/splatnet3';
import { WebServiceToken } from './coral-types.js';
import { NintendoAccountUser } from './na.js';
import { defineResponse, ErrorResponse, HasResponse, ResponseSymbol } from './util.js';
import CoralApi from './coral.js';
import { timeoutSignal } from '../util/misc.js';
import { BulletToken } from './splatnet3-types.js';

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
const SHOULD_RENEW_TOKEN_AT = 300; // 5 minutes in seconds
const TOKEN_EXPIRES_IN = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

const AUTH_ERROR_CODES = {
    204: 'USER_NOT_REGISTERED',
    400: 'ERROR_INVALID_PARAMETERS',
    401: 'ERROR_INVALID_GAME_WEB_TOKEN',
    403: 'ERROR_OBSOLETE_VERSION',
    429: 'ERROR_RATE_LIMIT',
    500: 'ERROR_SERVER',
    503: 'ERROR_SERVER_MAINTENANCE',
    599: 'ERROR_SERVER',
} as const;

const REPLAY_CODE_REGEX = /^[A-Z0-9]{16}$/;

export default class SplatNet3Api {
    onTokenShouldRenew: ((remaining: number, res: Response) => Promise<SplatNet3AuthData | void>) | null = null;
    onTokenExpired: ((res: Response) => Promise<SplatNet3AuthData | void>) | null = null;
    /** @internal */
    _renewToken: Promise<void> | null = null;

    protected constructor(
        public bullet_token: string,
        public version: string,
        public language: string,
        public useragent: string,
    ) {}

    async fetch<T = unknown>(
        url: string, method = 'GET', body?: string | FormData, headers?: object,
        /** @internal */ _log?: string,
        /** @internal */ _attempt = 0
    ): Promise<HasResponse<T, Response>> {
        if (this._renewToken) {
            await this._renewToken;
        }

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

        const version = response.headers.get('x-be-version');
        debug('fetch %s %s%s, response %s, server revision %s', method, url, _log ? ', ' + _log : '',
            response.status, version);

        if (response.status === 401 && !_attempt && this.onTokenExpired) {
            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenExpired.call(null, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
            return this.fetch(url, method, body, headers, _log, _attempt + 1);
        }

        if (response.status !== 200) {
            throw new ErrorResponse('[splatnet3] Non-200 status code', response, await response.text());
        }

        const remaining = parseInt(response.headers.get('x-bullettoken-remaining') ?? '0');

        if (remaining <= SHOULD_RENEW_TOKEN_AT && !_attempt && this.onTokenShouldRenew) {
            // _renewToken will be awaited when calling fetch
            this._renewToken = this._renewToken ?? this.onTokenShouldRenew.call(null, remaining, response).then(data => {
                if (data) this.setTokenWithSavedToken(data);
            }).finally(() => {
                this._renewToken = null;
            });
        }

        const data = await response.json() as T;

        return defineResponse(data, response);
    }

    async persistedQuery<
        T = unknown, V = unknown,

        /** @private */
        _Id extends string = string,
        /** @private */
        _Result extends (T extends unknown ? _Id extends KnownRequestId ? ResultTypes[_Id] : unknown : T) =
            (T extends unknown ? _Id extends KnownRequestId ? ResultTypes[_Id] : unknown : T),
        /** @private */
        _Variables extends (V extends unknown ? _Id extends KnownRequestId ? VariablesTypes[_Id] : unknown : V) =
            (V extends unknown ? _Id extends KnownRequestId ? VariablesTypes[_Id] : unknown : V),
    >(id: _Id, variables: _Variables) {
        const req: GraphQLRequest<_Variables> = {
            variables,
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: id,
                },
            },
        };

        const data = await this.fetch<GraphQLResponse<_Result>>('/graphql', 'POST', JSON.stringify(req), undefined,
            'graphql query ' + id);

        if ('errors' in data) {
            throw new ErrorResponse('[splatnet3] GraphQL error: ' + data.errors.map(e => e.message).join(', '),
                data[ResponseSymbol], data);
        }

        return data;
    }

    /** * */
    async getCurrentFest() {
        return this.persistedQuery(RequestId.CurrentFestQuery, {});
    }

    /** * */
    async getConfigureAnalytics() {
        return this.persistedQuery(RequestId.ConfigureAnalyticsQuery, {});
    }

    /** / */
    async getHome() {
        return this.persistedQuery(RequestId.HomeQuery, {});
    }

    /** / -> /setting */
    async getSettings() {
        return this.persistedQuery(RequestId.SettingQuery, {});
    }

    /** / -> /photo_album */
    async getPhotoAlbum() {
        return this.persistedQuery(RequestId.PhotoAlbumQuery, {});
    }

    /** / -> /photo_album -> pull-to-refresh */
    async getPhotoAlbumRefetch() {
        return this.persistedQuery(RequestId.PhotoAlbumRefetchQuery, {});
    }

    /** / -> /catalog_record */
    async getCatalog() {
        return this.persistedQuery(RequestId.CatalogQuery, {});
    }

    /** / -> /catalog_record -> pull-to-refresh */
    async getCatalogRefetch() {
        return this.persistedQuery(RequestId.CatalogRefetchQuery, {});
    }

    /** / -> /checkin */
    async getCheckinHistory() {
        return this.persistedQuery(RequestId.CheckinQuery, {});
    }

    /** / -> /checkin */
    async checkin(id: string) {
        return this.persistedQuery(RequestId.CheckinWithQRCodeMutation, {
            checkinEventId: id,
        });
    }

    /** / -> /friends */
    async getFriends() {
        return this.persistedQuery(RequestId.FriendListQuery, {});
    }

    /** / -> /friends -> pull-to-refresh */
    async getFriendsRefetch() {
        return this.persistedQuery(RequestId.FriendListRefetchQuery, {});
    }

    /** / -> /hero_record */
    async getHeroRecords() {
        return this.persistedQuery(RequestId.HeroHistoryQuery, {});
    }

    /** / -> /hero_record -> pull-to-refresh */
    async getHeroRecordsRefetch() {
        return this.persistedQuery(RequestId.HeroHistoryRefetchQuery, {});
    }

    /** / -> /history_record */
    async getHistoryRecords() {
        return this.persistedQuery(RequestId.HistoryRecordQuery, {});
    }

    /** / -> /history_record -> pull-to-refresh */
    async getHistoryRecordsRefetch() {
        return this.persistedQuery(RequestId.HistoryRecordRefetchQuery, {});
    }

    /** / -> /schedule */
    async getSchedules() {
        return this.persistedQuery(RequestId.StageScheduleQuery, {});
    }

    /** / -> /stage_record */
    async getStageRecords() {
        return this.persistedQuery(RequestId.StageRecordQuery, {});
    }

    /** / -> /stage_record -> pull-to-refresh */
    async getStageRecordsRefetch() {
        return this.persistedQuery(RequestId.StageRecordsRefetchQuery, {});
    }

    /** / -> /weapon_record */
    async getWeaponRecords() {
        return this.persistedQuery(RequestId.WeaponRecordQuery, {});
    }

    /** / -> /weapon_record -> pull-to-refresh */
    async getWeaponRecordsRefetch() {
        return this.persistedQuery(RequestId.WeaponRecordsRefetchQuery, {});
    }

    //
    // Wandercrust
    //

    /** / -> /challenge */
    async getChallengeHome() {
        return this.persistedQuery(RequestId.ChallengeQuery, {});
    }

    /** / -> /challenge -> pull-to-refresh */
    async getChallengeHomeRefetch() {
        return this.persistedQuery(RequestId.ChallengeRefetchQuery, {});
    }

    /** / -> /challenge -> /challenge/{id} */
    async getChallengeJourney(id: string) {
        return this.persistedQuery(RequestId.JourneyQuery, {
            id,
        });
    }

    /** / -> /challenge -> /challenge/{id} -> pull-to-refresh */
    async getChallengeJourneyRefetch(id: string) {
        return this.persistedQuery(RequestId.JourneyRefetchQuery, {
            id,
        });
    }

    /** / -> /challenge -> /challenge/{id} -> /challenge/{id}/*s */
    async getChallengeJourneyChallenges(id: string) {
        return this.persistedQuery(RequestId.JourneyChallengeDetailQuery, {
            journeyId: id,
        });
    }

    /** / -> /challenge -> /challenge/{id} -> /challenge/{id}/* -> pull-to-refresh */
    async getChallengeJourneyChallengesRefetch(id: string) {
        return this.persistedQuery(RequestId.JourneyChallengeDetailRefetchQuery, {
            journeyId: id,
        });
    }

    /** / -> /challenge -> /challenge/{id} -> /challenge/{id}/* -> support */
    async supportChallenge(id: string) {
        return this.persistedQuery(RequestId.SupportButton_SupportChallengeMutation, {
            id,
        });
    }

    //
    // Splatfests
    //

    /** / -> /fest_record */
    async getFestRecords() {
        return this.persistedQuery(RequestId.FestRecordQuery, {});
    }

    /** / -> /fest_record -> pull-to-refresh */
    async getFestRecordsRefetch() {
        return this.persistedQuery(RequestId.FestRecordRefetchQuery, {});
    }

    /** / -> /fest_record/{id} */
    async getFestDetail(id: string) {
        return this.persistedQuery(RequestId.DetailFestRecordDetailQuery, {
            festId: id,
        });
    }

    /** / -> /fest_record -> /fest_record/{id} -> pull-to-refresh */
    async getFestDetailRefetch(id: string) {
        return this.persistedQuery(RequestId.DetailFestRefethQuery, {
            festId: id,
        });
    }

    /** / -> /fest_record -> /fest_record/{id} - not closed -> /fest_record/voting_status/{id} */
    async getFestVotingStatus(id: string) {
        return this.persistedQuery(RequestId.DetailVotingStatusQuery, {
            festId: id,
        });
    }

    /** / -> /fest_record -> /fest_record/{id} - not closed -> /fest_record/voting_status/{id} -> pull-to-refresh */
    async getFestVotingStatusRefetch(id: string) {
        return this.persistedQuery(RequestId.DetailFestVotingStatusRefethQuery, {
            festId: id,
        });
    }

    /** / -> /fest_record -> /fest_record/{id} - not closed -> /fest_record/voting_status/{id} - not voted in game */
    async updateFestPoll(id: string) {
        return this.persistedQuery(RequestId.VotesUpdateFestVoteMutation, {
            teamId: id,
        });
    }

    /** / -> /fest_record -> /fest_record/{id} - closed -> /fest_record/ranking/{id} */
    async getFestRanking(id: string) {
        return this.persistedQuery(RequestId.DetailRankingQuery, {
            festId: id,
        });
    }

    //
    // SplatNet Shop
    //

    /** / -> /gesotown */
    async getSaleGear() {
        return this.persistedQuery(RequestId.GesotownQuery, {});
    }

    /** / -> /gesotown -> pull-to-refresh */
    async getSaleGearRefetch() {
        return this.persistedQuery(RequestId.GesotownRefetchQuery, {});
    }

    /** / -> /gesotown -> /gesotown/{id} */
    async getSaleGearDetail(id: string) {
        return this.persistedQuery(RequestId.SaleGearDetailQuery, {
            saleGearId: id,
        });
    }

    /** / -> /gesotown -> /gesotown/{id} -> order */
    async orderSaleGear(id: string, force = false) {
        return this.persistedQuery(RequestId.SaleGearDetailOrderGesotownGearMutation, {
            input: {
                id,
                isForceOrder: force,
            },
        });
    }

    //
    // Freshest Fits/my outfits
    //

    /** / -> /my_outfits */
    async getMyOutfits() {
        return this.persistedQuery(RequestId.MyOutfitsQuery, {});
    }

    /** / -> /my_outfits -> pull-to-refresh */
    async getMyOutfitsRefetch() {
        return this.persistedQuery(RequestId.MyOutfitsRefetchQuery, {});
    }

    /** / -> /my_outfits -> /my_outfits/{id} */
    async getMyOutfitDetail(id: string) {
        return this.persistedQuery(RequestId.MyOutfitDetailQuery, {
            myOutfitId: id,
        });
    }

    /** / -> /my_outfits -> /my_outfits/{id / create} */
    async getEquipmentFilters(id: string) {
        return this.persistedQuery(RequestId.MyOutfitCommonDataFilteringConditionQuery, {});
    }

    /** / -> /my_outfits -> /my_outfits/{id / create} */
    async getEquipment(id: string) {
        return this.persistedQuery(RequestId.MyOutfitCommonDataEquipmentsQuery, {});
    }

    /** / -> /my_outfits -> /my_outfits/{id / create} */
    async createOutfit(data: MyOutfitInput) {
        return this.persistedQuery(RequestId.CreateMyOutfitMutation, {
            input: {
                myOutfit: data,
            },
            connections: [
                'client:root:__connection_myOutfits_connection',
            ],
        });
    }

    /** / -> /my_outfits -> /my_outfits/{id / create} */
    async updateOutfit(id: string, data: MyOutfitInput) {
        return this.persistedQuery(RequestId.UpdateMyOutfitMutation, {
            input: {
                myOutfit: {
                    id,
                    ...data,
                },
            },
        });
    }

    //
    // Replays
    //

    /** / -> /replay */
    async getReplays() {
        return this.persistedQuery(RequestId.ReplayQuery, {});
    }

    /** / -> /replay -> pull-to-refetch */
    async getReplaysRefetch() {
        return this.persistedQuery(RequestId.ReplayUploadedReplayListRefetchQuery, {});
    }

    /** / -> /replay -> enter code */
    async getReplaySearchResult(code: string) {
        if (!REPLAY_CODE_REGEX.test(code)) throw new Error('Invalid replay code');

        return this.persistedQuery(RequestId.DownloadSearchReplayQuery, {
            code,
        });
    }

    /** / -> /replay -> enter code -> download */
    async reserveReplayDownload(id: string) {
        return this.persistedQuery(RequestId.ReplayModalReserveReplayDownloadMutation, {
            input: {
                id,
            },
        });
    }

    //
    // Battle history
    //

    /** / -> /history */
    async getBattleHistoryCurrentPlayer() {
        return this.persistedQuery(RequestId.BattleHistoryCurrentPlayerQuery, {});
    }

    /** / -> /history */
    async getLatestBattleHistories() {
        return this.persistedQuery(RequestId.LatestBattleHistoriesQuery, {});
    }

    /** / -> /history */
    async getRegularBattleHistories() {
        return this.persistedQuery(RequestId.RegularBattleHistoriesQuery, {});
    }

    /** / -> /history */
    async getBankaraBattleHistories() {
        return this.persistedQuery(RequestId.BankaraBattleHistoriesQuery, {});
    }

    /** / -> /history */
    async getPrivateBattleHistories() {
        return this.persistedQuery(RequestId.PrivateBattleHistoriesQuery, {});
    }

    /** / -> /history -> /history/detail/{id} */
    async getBattleHistoryDetail(id: string) {
        return this.persistedQuery(RequestId.VsHistoryDetailQuery, {
            vsResultId: id,
        });
    }

    /** / -> /history -> /history/detail/{id} -> pull-to-refresh */
    async getBattleHistoryDetailPagerRefetch(id: string) {
        return this.persistedQuery(RequestId.VsHistoryDetailPagerRefetchQuery, {
            vsResultId: id,
        });
    }

    /** / -> /history -> /history/detail/* -> latest */
    async getBattleHistoryLatest() {
        return this.persistedQuery(RequestId.PagerLatestVsDetailQuery, {});
    }

    /** / -> /history -> /history/detail/* -> latest */
    async getBattleHistoryPagerUpdateByVsMode() {
        return this.persistedQuery(RequestId.PagerUpdateBattleHistoriesByVsModeQuery, {
            isBankara: false,
            isLeague: false,
            isPrivate: false,
            isRegular: false,
            isXBattle: false,
        });
    }

    //
    // Salmon Run
    //

    /** / -> /coop */
    async getCoopHistory() {
        return this.persistedQuery(RequestId.CoopHistoryQuery, {});
    }

    /** / -> /coop */
    async getCoopHistoryRefetch() {
        return this.persistedQuery(RequestId.RefetchableCoopHistory_CoopResultQuery, {});
    }

    /** / -> /coop -> /coop/{id} */
    async getCoopHistoryDetail(id: string) {
        return this.persistedQuery(RequestId.CoopHistoryDetailQuery, {
            coopHistoryDetailId: id,
        });
    }

    /** / -> /coop -> /coop/{id} -> pull-to-refresh */
    async getCoopHistoryDetailRefetch(id: string) {
        return this.persistedQuery(RequestId.CoopHistoryDetailRefetchQuery, {
            id,
        });
    }

    /** / -> /coop -> /coop/* -> latest */
    async getCoopHistoryLatest() {
        return this.persistedQuery(RequestId.CoopPagerLatestCoopQuery, {});
    }

    //
    //

    async renewTokenWithCoral(nso: CoralApi, user: NintendoAccountUser) {
        const data = await SplatNet3Api.loginWithCoral(nso, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    async renewTokenWithWebServiceToken(webserviceToken: WebServiceToken, user: NintendoAccountUser) {
        const data = await SplatNet3Api.loginWithWebServiceToken(webserviceToken, user);
        this.setTokenWithSavedToken(data);
        return data;
    }

    protected setTokenWithSavedToken(data: SplatNet3AuthData) {
        this.bullet_token = data.bullet_token.bulletToken;
        this.version = data.version;
        this.language = data.bullet_token.lang;
        this.useragent = data.useragent;
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
        const tr = await fetch(SPLATNET3_URL + '/bullet_tokens', {
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

        const error: string | undefined = AUTH_ERROR_CODES[tr.status as keyof typeof AUTH_ERROR_CODES];
        if (error) throw new ErrorResponse('[splatnet3] ' + error, tr, await tr.text());
        if (tr.status !== 201) throw new ErrorResponse('[splatnet3] Non-201 status code', tr, await tr.text());

        const bullet_token = await tr.json() as BulletToken;
        const created_at = Date.now();
        const expires_at = created_at + TOKEN_EXPIRES_IN;

        return {
            webserviceToken,
            url: url.toString(),
            cookies,
            body,

            language,
            country: user.country,
            version,

            bullet_token,
            created_at,
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
    created_at: number;
    /**
     * /api/bullet_tokens does not provide the token validity duration. Instead this assumes
     * the token is valid for 2 hours. GraphQL responses include the actual remaining time
     * in the x-bullettoken-remaining header.
     */
    expires_at: number;
    useragent: string;
}

export interface SplatNet3CliTokenData {
    bullet_token: string;
    expires_at: number;
    language: string;
    version: string;
}
