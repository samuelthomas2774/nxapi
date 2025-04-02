import persist from 'node-persist';
import DiscordRPC from 'discord-rpc';
import { BankaraMatchMode, CoopRule, CoopSetting_schedule, DetailVotingStatusResult, FestMatchMode, FestTeam_schedule, FestTeam_votingStatus, Fest_schedule, FriendListResult, FriendOnlineState, GraphQLSuccessResponse, StageScheduleResult, VsMode, VsSchedule_regular } from 'splatnet3-types/splatnet3';
import { Game } from '../../api/coral-types.js';
import SplatNet3Api, { SplatNet3GraphQLErrorResponse } from '../../api/splatnet3.js';
import { DiscordPresenceExternalMonitorsConfiguration } from '../../app/common/types.js';
import { Arguments } from '../../cli/nso/presence.js';
import { getBulletToken, SavedBulletToken } from '../../common/auth/splatnet3.js';
import { ExternalMonitorPresenceInterface } from '../../common/presence.js';
import createDebug from '../../util/debug.js';
import { EmbeddedLoop, LoopResult } from '../../util/loop.js';
import { ArgumentsCamelCase } from '../../util/yargs.js';
import { product } from '../../util/product.js';
import { DiscordPresenceContext, ErrorResult } from '../types.js';

const debug = createDebug('nxapi:discord:splatnet3');

type VsSchedule_event = StageScheduleResult['eventSchedules']['nodes'][0];
type LeagueMatchSetting_schedule = VsSchedule_event['leagueMatchSetting'];

type VsSetting_schedule =
    StageScheduleResult['regularSchedules']['nodes'][0]['regularMatchSetting'] |
    StageScheduleResult['bankaraSchedules']['nodes'][0]['bankaraMatchSettings'][0] |
    StageScheduleResult['eventSchedules']['nodes'][0]['leagueMatchSetting'] |
    StageScheduleResult['xSchedules']['nodes'][0]['xMatchSetting'] |
    StageScheduleResult['festSchedules']['nodes'][0]['festMatchSettings'][0];

export default class SplatNet3Monitor extends EmbeddedLoop {
    update_interval: number = 1 * 60; // 1 minute in seconds

    splatnet: SplatNet3Api | null = null;
    data: SavedBulletToken | null = null;

    cached_friends: GraphQLSuccessResponse<FriendListResult> | null = null;
    cached_schedules: GraphQLSuccessResponse<StageScheduleResult> | null = null;
    cached_voting_status: GraphQLSuccessResponse<DetailVotingStatusResult> | null = null;

    friend: FriendListResult['friends']['nodes'][0] | null = null;

    regular_schedule: VsSchedule_regular | null = null;
    vs_setting: VsSetting_schedule | null = null;
    coop_setting: CoopSetting_schedule | null = null;

    fest: Fest_schedule | null = null;
    fest_team_voting_status: FestTeam_votingStatus | null = null;
    fest_team: FestTeam_schedule | null = null;

    constructor(
        readonly discord_presence: ExternalMonitorPresenceInterface,
        protected config: SplatNet3MonitorConfig | null,
    ) {
        super();
    }

    onUpdateConfig(config: SplatNet3MonitorConfig | null) {
        if (!!config !== !!this.config) return false;

        if (config?.storage !== this.config?.storage) return false;
        if (config?.na_session_token !== this.config?.na_session_token) return false;
        if (config?.znc_proxy_url !== this.config?.znc_proxy_url) return false;
        if (config?.allow_fetch_token !== this.config?.allow_fetch_token) return false;

        this.config = config;
        this.skipIntervalInCurrentLoop();

        return true;
    }

    get friend_nsaid() {
        return this.config?.friend_nsaid ?? this.discord_presence.znc_discord_presence.presence_user;
    }

    async init(): Promise<LoopResult | void> {
        if (!this.config) {
            debug('Not enabling SplatNet 3 monitor - not configured');
            return LoopResult.STOP;
        }

        debug('Started monitor');

        try {
            const {splatnet, data} = await getBulletToken(
                this.config.storage,
                this.config.na_session_token,
                this.config.znc_proxy_url,
                this.config.allow_fetch_token,
            );

            this.splatnet = splatnet;
            this.data = data;
        } catch (err) {
            debug('Error authenticating to SplatNet 3', err);
            const result = await this.discord_presence.handleError(err as Error);
            if (result === ErrorResult.RETRY) return this.init();
            if (result === ErrorResult.STOP) return LoopResult.STOP;
        }

        const history = await this.splatnet!.getHistoryRecords().catch(err => {
            if (err instanceof SplatNet3GraphQLErrorResponse) {
                debug('Error in HistoryRecordQuery', err);
                return null;
            }

            throw err;
        });

        this.splatnet!.getCurrentFest().catch(err => debug('Error in useCurrentFest', err));
        this.splatnet!.getConfigureAnalytics().catch(err => debug('Error in ConfigureAnalyticsQuery', err));

        if (history) {
            debug('Authenticated to SplatNet 3 %s - player %s#%s (title %s, first played %s)', this.data!.version,
                history.data.currentPlayer.name,
                history.data.currentPlayer.nameId,
                history.data.currentPlayer.byname,
                new Date(history.data.playHistory.gameStartTime).toLocaleString());
        } else {
            debug('Authenticated to SplatNet 3 - unable to retrieve history data');
        }

        this.cached_friends = await this.splatnet!.getFriends();
        this.cached_schedules = await this.splatnet!.getSchedules();
    }

    async update() {
        if (!this.config) {
            debug('Not updating SplatNet 3 monitor - not configured');
            return LoopResult.STOP;
        }

        const friends = this.cached_friends ?? await this.splatnet?.getFriendsRefetch();
        this.cached_friends = null;

        const friend_id = Buffer.from('Friend-' + this.friend_nsaid).toString('base64');
        const friend = friends?.data.friends.nodes.find(f => f.id === friend_id) ?? null;

        this.friend = friend;

        this.regular_schedule = getSchedule(this.cached_schedules?.data.regularSchedules.nodes ?? []);

        if (!this.regular_schedule) {
            this.cached_schedules = await this.splatnet?.getSchedules() ?? null;
            this.regular_schedule = getSchedule(this.cached_schedules?.data.regularSchedules.nodes ?? []);
        }

        this.vs_setting = this.cached_schedules && friend?.vsMode ?
            getSettingForVsMode(this.cached_schedules.data, friend.vsMode) ?? null : null;
        this.coop_setting = this.cached_schedules && friend?.coopRule ?
            getSettingForCoopRule(this.cached_schedules.data.coopGroupingSchedule,
                friend.coopRule as CoopRule) ?? null : null;

        this.fest = this.cached_schedules?.data.currentFest ?? null;

        // Identify the user by their icon as the vote list doesn't have friend IDs
        let fest_team = this.cached_voting_status?.data.fest?.teams
            .find(t => t.votes?.nodes.find(f => f.userIcon.url === friend?.userIcon.url));

        if (this.fest && friend && (!this.cached_voting_status || (friend.vsMode?.mode === 'FEST' && !fest_team))) {
            this.cached_voting_status = await this.splatnet?.getFestVotingStatus(this.fest.id) ?? null;

            fest_team = this.cached_voting_status?.data.fest?.teams
                .find(t => t.votes?.nodes.find(f => f.userIcon.url === friend?.userIcon.url));
        }

        this.fest_team_voting_status = fest_team ?? null;

        this.discord_presence.refreshPresence();
    }

    async handleError(err: Error) {
        const result = await this.discord_presence.handleError(err as Error);
        if (result === ErrorResult.RETRY) return LoopResult.OK_SKIP_INTERVAL;

        this.friend = null;
        this.discord_presence.refreshPresence();

        if (result === ErrorResult.STOP) return LoopResult.STOP;
        return LoopResult.OK;
    }
}

export function getSettingForVsMode(schedules: StageScheduleResult, vs_mode: Pick<VsMode, 'id' | 'mode'>) {
    if (vs_mode.mode === 'REGULAR') {
        return getSchedule(schedules.regularSchedules)?.regularMatchSetting;
    }
    if (vs_mode.mode === 'BANKARA') {
        const settings = getSchedule(schedules.bankaraSchedules)?.bankaraMatchSettings;

        if (vs_mode.id === 'VnNNb2RlLTI=') {
            return settings?.find(s => s.bankaraMode === BankaraMatchMode.CHALLENGE);
        }
        if (vs_mode.id === 'VnNNb2RlLTUx') {
            return settings?.find(s => s.bankaraMode === BankaraMatchMode.OPEN);
        }
    }
    if (vs_mode.mode === 'FEST') {
        const settings = getSchedule(schedules.festSchedules)?.festMatchSettings;

        if (vs_mode.id === 'VnNNb2RlLTY=') {
            return settings?.find(s => (s as VsSetting_schedule)!.festMode === FestMatchMode.REGULAR);
        }
        if (vs_mode.id === 'VnNNb2RlLTc=') {
            return settings?.find(s => (s as VsSetting_schedule)!.festMode === FestMatchMode.CHALLENGE);
        }
    }
    if (vs_mode.mode === 'LEAGUE') {
        return getSchedule(schedules.eventSchedules)?.leagueMatchSetting;
    }
    if (vs_mode.mode === 'X_MATCH') {
        return getSchedule(schedules.xSchedules)?.xMatchSetting;
    }
    return null;
}

export function getSettingForCoopRule(schedules: StageScheduleResult['coopGroupingSchedule'], coop_rule: CoopRule) {
    if (coop_rule === CoopRule.REGULAR) {
        return getSchedule(schedules.regularSchedules)?.setting;
    }
    if (coop_rule === CoopRule.BIG_RUN) {
        return getSchedule(schedules.bigRunSchedules)?.setting;
    }
    if (coop_rule === CoopRule.TEAM_CONTEST) {
        return getSchedule(schedules.teamContestSchedules)?.setting;
    }
    return null;
}

interface TimePeriod {
    startTime: string;
    endTime: string;
}
interface HasTimePeriods {
    timePeriods: TimePeriod[];
}

export function getSchedule<T extends TimePeriod | HasTimePeriods>(schedules: T[] | {nodes: T[]}): T | null {
    if ('nodes' in schedules) schedules = schedules.nodes;
    const now = Date.now();

    for (const schedule of schedules) {
        const time_periods = 'timePeriods' in schedule ? schedule.timePeriods : [schedule] as [T & TimePeriod];

        for (const time_period of time_periods) {
            const start = new Date(time_period.startTime);
            const end = new Date(time_period.endTime);

            if (start.getTime() >= now) continue;
            if (end.getTime() < now) continue;

            return schedule;
        }
    }

    return null;
}

export interface SplatNet3MonitorConfig {
    storage: persist.LocalStorage;
    na_session_token: string;
    znc_proxy_url?: string;
    allow_fetch_token: boolean;
    friend_nsaid?: string;
}

export function getConfigFromArgv(
    argv: ArgumentsCamelCase<Arguments>,
    storage: persist.LocalStorage,
    na_session_token: string,
): SplatNet3MonitorConfig | null {
    if (!argv.splatnet3Monitor) return null;

    return {
        storage,
        na_session_token,
        znc_proxy_url: argv.zncProxyUrl,
        allow_fetch_token: argv.splatnet3AutoUpdateSession,
    };
}

export function getConfigFromAppConfig(
    config: DiscordPresenceExternalMonitorsConfiguration,
    storage: persist.LocalStorage,
    na_session_token: string,
): SplatNet3MonitorConfig | null {
    if (!config.enable_splatnet3_monitoring) return null;

    return {
        storage,
        na_session_token,
        znc_proxy_url: process.env.ZNC_PROXY_URL,
        allow_fetch_token: true,
    };
}

interface PresenceUrlResponse {
    splatoon3?: FriendListResult['friends']['nodes'][0] | null;
    splatoon3_fest_team?: (FestTeam_votingStatus & FestTeam_schedule) | null;
    splatoon3_vs_setting?: VsSetting_schedule | null;
    splatoon3_coop_setting?: CoopSetting_schedule | null;
    splatoon3_fest?: Fest_schedule | null;
}

export function callback(activity: DiscordRPC.Presence, game: Game, context?: DiscordPresenceContext) {
    const monitor = context?.monitors?.find(m => m instanceof SplatNet3Monitor) as SplatNet3Monitor | undefined;
    const presence_proxy_data = context?.proxy_response ? context.proxy_response as PresenceUrlResponse : null;

    const friend = presence_proxy_data?.splatoon3 ?? monitor?.friend;
    const fest = presence_proxy_data?.splatoon3_fest ?? monitor?.fest;
    const fest_team = presence_proxy_data?.splatoon3_fest_team ?? monitor?.fest_team;
    const fest_team_voting_status = presence_proxy_data?.splatoon3_fest_team ?? monitor?.fest_team_voting_status;

    if (!friend) return;

    if ((friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ||
        friend.onlineState === FriendOnlineState.VS_MODE_FIGHTING) && friend.vsMode
    ) {
        const mode_name =
            friend.vsMode.mode === 'REGULAR' ? 'Regular Battle' :
            friend.vsMode.id === 'VnNNb2RlLTI=' ? 'Anarchy Battle (Series)' : // VsMode-2
            friend.vsMode.id === 'VnNNb2RlLTUx' ? 'Anarchy Battle (Open)' : // VsMode-51
            friend.vsMode.mode === 'BANKARA' ? 'Anarchy Battle' :
            friend.vsMode.id === 'VnNNb2RlLTY=' ? 'Splatfest Battle (Open)' : // VsMode-6
            friend.vsMode.id === 'VnNNb2RlLTc=' ? 'Splatfest Battle (Pro)' : // VsMode-7
            friend.vsMode.id === 'VnNNb2RlLTg=' ? 'Tricolour Battle' : // VsMode-8
            friend.vsMode.mode === 'FEST' ? 'Splatfest Battle' :
            friend.vsMode.id === 'VnNNb2RlLTQ=' ? 'Challenge' : // VsMode-4
            friend.vsMode.mode === 'LEAGUE' ? 'Challenge' :
            friend.vsMode.mode === 'X_MATCH' ? 'X Battle' : // VsMode-3
            undefined;

        const setting =
            presence_proxy_data && 'splatoon3_vs_setting' in presence_proxy_data ?
                presence_proxy_data.splatoon3_vs_setting :
            monitor?.vs_setting;

        activity.details =
            (mode_name ?? friend.vsMode.name) +
            (friend.vsMode.mode === 'FEST' && fest_team_voting_status ?
                ' - Team ' + fest_team_voting_status.teamName : '') +
            (friend.vsMode.mode === 'LEAGUE' && setting && 'leagueMatchEvent' in setting ?
                ': ' + (setting as LeagueMatchSetting_schedule).leagueMatchEvent.name : '') +
            (friend.vsMode.mode !== 'FEST' && friend.vsMode.mode !== 'LEAGUE' && setting ?
                ' - ' + setting.vsRule.name : '') +
            (friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ? ' (matching)' : '');

        if (friend.vsMode.id === 'VnNNb2RlLTg=' && fest?.tricolorStage) {
            const tricolour_stage_image = new URL(fest.tricolorStage.image.url);
            const match = tricolour_stage_image.pathname.match(/^\/resources\/prod\/(.+)$/);
            const proxy_stage_image =
                tricolour_stage_image.host === 'splatoon3.ink' ? tricolour_stage_image.href :
                match ? 'https://splatoon3.ink/assets/splatnet/' + match[1] :
                null;

            if (proxy_stage_image) {
                activity.largeImageKey = proxy_stage_image;
                activity.largeImageText = fest.tricolorStage.name +
                    ' | ' + product;
            }
        }

        if (setting) {
            // In the second half the player may be in a Tricolour battle if either:
            // the player is on the defending team and joins Splatfest Battle (Open) or
            // the player is on the attacking team and joins Tricolour Battle
            // const possibly_tricolour = fest?.state === FestState.SECOND_HALF && (
            //     (friend.vsMode.id === 'VnNNb2RlLTY=' && fest_team?.role === FestTeamRole.DEFENSE) ||
            //     (friend.vsMode.id === 'VnNNb2RlLTg=')
            // );

            activity.largeImageKey = 'https://fancy.org.uk/api/nxapi/s3/image?' + new URLSearchParams({
                a: setting.vsStages[0].id,
                b: setting.vsStages[1].id,
                // ...(possibly_tricolour ? {t: fest?.tricolorStage.id} : {}),
                v: '2022092400',
            }).toString();
            activity.largeImageText = setting.vsStages.map(s => s.name).join('/') +
                // (possibly_tricolour ? '/' + fest?.tricolorStage.name : '') +
                ' | ' + product;
        }

        // REGULAR, BANKARA, X_MATCH, LEAGUE, PRIVATE, FEST
        const mode_image =
            friend.vsMode.mode === 'FEST' && fest ? 'https://fancy.org.uk/api/nxapi/s3/fest-icon?' + new URLSearchParams({
                id: fest.id,
                v: '2023060401',
            }).toString() :
            friend.vsMode.mode === 'REGULAR' ? 'mode-vs-regular-2' :
            friend.vsMode.mode === 'BANKARA' ? 'mode-vs-bankara-2' :
            friend.vsMode.mode === 'FEST' ? 'mode-fest-1' :
            friend.vsMode.mode === 'LEAGUE' ? 'mode-vs-event-1' :
            friend.vsMode.mode === 'X_MATCH' ? 'mode-vs-xmatch-2' :
            friend.vsMode.mode === 'PRIVATE' ? 'mode-vs-private-1' :
            undefined;

        activity.smallImageKey = mode_image;
        activity.smallImageText = mode_name ?? friend.vsMode.name;
    }

    if (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ||
        friend.onlineState === FriendOnlineState.COOP_MODE_FIGHTING
    ) {
        activity.details = 'Salmon Run' +
            (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ? ' (matching)' : '');

        const setting =
            presence_proxy_data && 'splatoon3_coop_setting' in presence_proxy_data ?
                presence_proxy_data.splatoon3_coop_setting :
            monitor?.coop_setting;

        if (setting) {
            const coop_stage_image = new URL(setting.coopStage.image.url);
            const match = coop_stage_image.pathname.match(/^\/resources\/prod\/(.+)$/);
            const proxy_stage_image =
                coop_stage_image.host === 'splatoon3.ink' ? coop_stage_image.href :
                match ? 'https://splatoon3.ink/assets/splatnet/' + match[1] :
                null;

            if (proxy_stage_image) {
                activity.largeImageKey = proxy_stage_image;
                activity.largeImageText = setting.coopStage.name +
                    ' | ' + product;
            }
        }

        if (friend.coopRule === CoopRule.REGULAR) {
            activity.smallImageKey = 'mode-coop-regular-1';
            activity.smallImageText = 'Salmon Run';
        }
        if (friend.coopRule === CoopRule.BIG_RUN) {
            activity.smallImageKey = 'mode-coop-bigrun-1';
            activity.smallImageText = 'Big Run';
        }
        if (friend.coopRule === CoopRule.TEAM_CONTEST) {
            activity.smallImageKey = 'mode-coop-teamcontest-1';
            activity.smallImageText = 'Eggstra Work';
        }
    }

    if (friend.onlineState === FriendOnlineState.MINI_GAME_PLAYING) {
        activity.details = 'Tableturf Battle';
    }
}
