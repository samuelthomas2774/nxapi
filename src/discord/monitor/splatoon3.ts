import createDebug from 'debug';
import persist from 'node-persist';
import DiscordRPC from 'discord-rpc';
import { BankaraMatchMode, BankaraMatchSetting, CoopSchedule, CoopSchedule_schedule, CoopSetting, DetailVotingStatusResult, FestMatchSetting, FestState, FestTeamRole, FestTeam_schedule, FestTeam_votingStatus, Fest_schedule, FriendListResult, FriendOnlineState, GraphQLSuccessResponse, LeagueMatchSetting, RegularMatchSetting, StageScheduleResult, VsSchedule_bankara, VsSchedule_fest, VsSchedule_league, VsSchedule_regular, VsSchedule_xMatch, XMatchSetting } from 'splatnet3-types/splatnet3';
import { Game } from '../../api/coral-types.js';
import SplatNet3Api from '../../api/splatnet3.js';
import { DiscordPresenceExternalMonitorsConfiguration } from '../../app/common/types.js';
import { Arguments } from '../../cli/nso/presence.js';
import { getBulletToken, SavedBulletToken } from '../../common/auth/splatnet3.js';
import { ExternalMonitorPresenceInterface } from '../../common/presence.js';
import { EmbeddedLoop, LoopResult } from '../../util/loop.js';
import { ArgumentsCamelCase } from '../../util/yargs.js';
import { DiscordPresenceContext, ErrorResult } from '../types.js';
import { product } from '../../util/product.js';

const debug = createDebug('nxapi:discord:splatnet3');

export default class SplatNet3Monitor extends EmbeddedLoop {
    update_interval: number = 1 * 60; // 1 minute in seconds

    splatnet: SplatNet3Api | null = null;
    data: SavedBulletToken | null = null;

    cached_friends: GraphQLSuccessResponse<FriendListResult> | null = null;
    cached_schedules: GraphQLSuccessResponse<StageScheduleResult> | null = null;
    cached_voting_status: GraphQLSuccessResponse<DetailVotingStatusResult> | null = null;

    friend: FriendListResult['friends']['nodes'][0] | null = null;

    regular_schedule: VsSchedule_regular | null = null;
    anarchy_schedule: VsSchedule_bankara | null = null;
    fest_schedule: VsSchedule_fest | null = null;
    league_schedule: VsSchedule_league | null = null;
    x_schedule: VsSchedule_xMatch | null = null;
    coop_regular_schedule: CoopSchedule_schedule | null = null;
    coop_big_run_schedule: CoopSchedule_schedule | null = null;
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
            const result = await this.discord_presence.handleError(err as Error);
            if (result === ErrorResult.RETRY) return this.init();
            if (result === ErrorResult.STOP) return LoopResult.STOP;
        }

        const history = await this.splatnet!.getHistoryRecords();

        Promise.all([
            this.splatnet!.getCurrentFest(),
            this.splatnet!.getConfigureAnalytics(),
        ]).catch(err => {
            debug('Error in useCurrentFest/ConfigureAnalyticsQuery', err);
        });

        debug('Authenticated to SplatNet 3 %s - player %s#%s (title %s, first played %s)', this.data!.version,
            history.data.currentPlayer.name,
            history.data.currentPlayer.nameId,
            history.data.currentPlayer.byname,
            new Date(history.data.playHistory.gameStartTime).toLocaleString());

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

        this.regular_schedule = this.getSchedule(this.cached_schedules?.data.regularSchedules.nodes ?? []);

        if (!this.regular_schedule) {
            this.cached_schedules = await this.splatnet?.getSchedules() ?? null;
            this.regular_schedule = this.getSchedule(this.cached_schedules?.data.regularSchedules.nodes ?? []);
        }

        this.anarchy_schedule = this.getSchedule(this.cached_schedules?.data.bankaraSchedules.nodes ?? []);
        this.fest_schedule = this.getSchedule(this.cached_schedules?.data.festSchedules.nodes ?? []);
        this.league_schedule = this.getSchedule(this.cached_schedules?.data.leagueSchedules.nodes ?? []);
        this.x_schedule = this.getSchedule(this.cached_schedules?.data.xSchedules.nodes ?? []);
        this.coop_regular_schedule = this.getSchedule(this.cached_schedules?.data.coopGroupingSchedule.regularSchedules.nodes ?? []);
        this.coop_big_run_schedule = this.getSchedule(this.cached_schedules?.data.coopGroupingSchedule.bigRunSchedules.nodes ?? []);
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

    getSchedule<T extends {startTime: string; endTime: string;}>(schedules: T[]): T | null {
        const now = Date.now();

        for (const schedule of schedules) {
            const start = new Date(schedule.startTime);
            const end = new Date(schedule.endTime);

            if (start.getTime() >= now) continue;
            if (end.getTime() < now) continue;

            return schedule;
        }

        return null;
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
    splatoon3_vs_setting?:
        RegularMatchSetting | BankaraMatchSetting | FestMatchSetting |
        LeagueMatchSetting | XMatchSetting | null;
    splatoon3_coop_setting?: CoopSetting | null;
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
            friend.vsMode.mode === 'LEAGUE' ? 'League Battle' :
            friend.vsMode.mode === 'X_MATCH' ? 'X Battle' :
            undefined;

        const setting =
            presence_proxy_data && 'splatoon3_vs_setting' in presence_proxy_data ?
                presence_proxy_data.splatoon3_vs_setting :
            !monitor ? null :
            friend.vsMode.mode === 'REGULAR' ? monitor.regular_schedule?.regularMatchSetting :
            friend.vsMode.mode === 'BANKARA' ?
                friend.vsMode.id === 'VnNNb2RlLTI=' ?
                    monitor.anarchy_schedule?.bankaraMatchSettings?.find(s => s.mode === BankaraMatchMode.CHALLENGE) :
                friend.vsMode.id === 'VnNNb2RlLTUx' ?
                    monitor.anarchy_schedule?.bankaraMatchSettings?.find(s => s.mode === BankaraMatchMode.OPEN) :
                null :
            friend.vsMode.mode === 'FEST' ? monitor.fest_schedule?.festMatchSetting :
            friend.vsMode.mode === 'LEAGUE' ? monitor.league_schedule?.leagueMatchSetting :
            friend.vsMode.mode === 'X_MATCH' ? monitor.x_schedule?.xMatchSetting :
            null;

        activity.details =
            (mode_name ?? friend.vsMode.name) +
            (friend.vsMode.mode === 'FEST' && fest_team_voting_status ?
                ' - Team ' + fest_team_voting_status.teamName : '') +
            (friend.vsMode.mode !== 'FEST' && setting ? ' - ' + setting.vsRule.name : '') +
            (friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ? ' (matching)' : '');

        if (setting) {
            // In the second half the player may be in a Tricolour battle if either:
            // the player is on the defending team and joins Splatfest Battle (Open) or
            // the player is on the attacking team and joins Tricolour Battle
            // const possibly_tricolour = fest?.state === FestState.SECOND_HALF && (
            //     (friend.vsMode?.id === 'VnNNb2RlLTY=' && fest_team?.role === FestTeamRole.DEFENSE) ||
            //     (friend.vsMode?.id === 'VnNNb2RlLTg=')
            // );
            const possibly_tricolour = friend.vsMode?.id === 'VnNNb2RlLTg=';

            activity.largeImageKey = 'https://fancy.org.uk/api/nxapi/s3/image?' + new URLSearchParams({
                a: setting.vsStages[0].id,
                b: setting.vsStages[1].id,
                ...(possibly_tricolour ? {t: fest?.tricolorStage.id} : {}),
                v: '2022092400',
            }).toString();
            activity.largeImageText = setting.vsStages.map(s => s.name).join('/') +
                (possibly_tricolour ? '/' + fest?.tricolorStage.name : '') +
                ' | ' + product;
        }

        // REGULAR, BANKARA, X_MATCH, LEAGUE, PRIVATE, FEST
        const mode_image =
            friend.vsMode.mode === 'REGULAR' ? 'mode-regular-1' :
            friend.vsMode.mode === 'BANKARA' ? 'mode-anarchy-1' :
            friend.vsMode.mode === 'FEST' ? 'mode-fest-1' :
            friend.vsMode.mode === 'LEAGUE' ? 'mode-league-1' :
            friend.vsMode.mode === 'X_MATCH' ? 'mode-x-1' :
            undefined;

        activity.smallImageKey = mode_image;
        activity.smallImageText = mode_name ?? friend.vsMode.name;
    }

    if (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ||
        friend.onlineState === FriendOnlineState.COOP_MODE_FIGHTING
    ) {
        activity.details = 'Salmon Run' +
            (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ? ' (matching)' : '');

        const coop_setting =
            presence_proxy_data && 'splatoon3_coop_setting' in presence_proxy_data ?
                presence_proxy_data.splatoon3_coop_setting :
            monitor ?
                friend.coopRule === 'BIG_RUN' ?
                    monitor.coop_big_run_schedule?.setting :
                    monitor.coop_regular_schedule?.setting :
            null;

        if (coop_setting) {
            const coop_stage_image = new URL(coop_setting.coopStage.image.url);
            const match = coop_stage_image.pathname.match(/^\/resources\/prod\/(.+)$/);
            const proxy_stage_image =
                coop_stage_image.host === 'splatoon3.ink' ? coop_stage_image.href :
                match ? 'https://splatoon3.ink/assets/splatnet/' + match[1] :
                null;

            if (proxy_stage_image) {
                activity.largeImageKey = proxy_stage_image;
                activity.largeImageText = coop_setting.coopStage.name +
                    ' | ' + product;
            }
        }
    }
}
