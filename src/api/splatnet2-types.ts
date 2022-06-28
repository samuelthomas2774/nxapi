export interface WebServiceError {
    code: string;
    message: string;
}

/** GET /records */
export interface Records {
    challenges: Challenges;
    festivals: unknown[];
    records: {
        recent_disconnect_count: number;
        recent_win_count: number;
        stage_stats: unknown;
        update_time: number;
        recent_lose_count: number;
        league_stats: {
            team: LeagueStats;
            pair: LeagueStats;
        };
        fes_results: unknown;
        unique_id: string;
        weapon_stats: Record<string | number, WeaponStats>;
        win_count: number;
        lose_count: number;
        total_paint_point_octa: number;
        player: Player;
        start_time: number;
    };
}

interface Challenges {
    next_challenge: Challenge;
    archived_challenges_octa: OctaChallenge[];
    total_paint_point: number;
    rewards: ChallengeReward[];
    total_paint_point_octa: number;
    rewards_octa: ChallengeReward[];
    archived_challenges: Challenge[];
    next_challenge_octa: OctaChallenge;
}
export interface Challenge {
    image: string;
    key: string;
    name: string;
    paint_points: number;
}
export interface OctaChallenge {
    key: string;
    paint_points: number;
    url: null;
    url_message: null;
    name: string;
    is_last: boolean;
    image: string;
}
interface ChallengeReward {
    id: string;
    images: {
        thumbnail: string;
        url: string;
    }[];
    paint_points: number;
}

interface LeagueStats {
    gold_count: number;
    bronze_count: number;
    silver_count: number;
    no_medal_count: number;
}

interface WeaponStats {
    win_meter: number;
    total_paint_point: number;
    last_use_time: number;
    lose_count: number;
    weapon: Weapon;
    win_count: number;
    max_win_meter: number;
}

interface Weapon {
    name: string;
    id: string;
    thumbnail: string;
    sub: SubWeapon;
    special: SpecialWeapon;
    image: string;
}
interface SubWeapon {
    image_b: string;
    name: string;
    id: string;
    image_a: string;
}
interface SpecialWeapon {
    image_a: string;
    id: string;
    name: string;
    image_b: string;
}

interface Player {
    clothes: Gear & {kind: GearType.CLOTHES};
    star_rank: number;
    head_skills: Skills;
    nickname: string;
    shoes_skills: Skills;
    weapon: Weapon;
    player_rank: number;
    max_league_point_team: number;
    shoes: Gear & {kind: GearType.SHOES};
    clothes_skills: Skills;
    udemae_tower: Rank;
    udemae_clam: Rank;
    udemae_rainmaker: Rank;
    player_type: PlayerType;
    head: Gear & {kind: GearType.HEAD};
    max_league_point_pair: number;
    principal_id: string;
    udemae_zones: Rank;
}

interface Gear {
    name: string;
    brand: Brand;
    id: string;
    rarity: number;
    image: string;
    kind: GearType;
    thumbnail: string;
}
export enum GearType {
    CLOTHES = 'clothes',
    SHOES = 'shoes',
    HEAD = 'head',
}
interface Brand {
    image: string;
    frequent_skill?: Skill;
    name: string;
    id: string;
}
interface Skills {
    subs: (Skill | null)[];
    main: Skill;
}
interface Skill {
    name: string;
    id: string;
    image: string;
}

interface Rank {
    name: null;
    s_plus_number: null;
    is_x: boolean;
    number: number;
    is_number_reached: boolean;
}

interface PlayerType {
    species: PlayerSpecies;
    style: PlayerStyle;
}
enum PlayerSpecies {
    INKLING = 'inklings',
    OCTOLING = 'octolings',
}
enum PlayerStyle {
    GIRL = 'girl',
    BOY = 'boy',
}

/** GET /data/stages */
export interface Stages {
    stages: Stage[];
}

export interface Stage {
    image: string;
    name: string;
    id: string;
}

/** GET /festivals/active */
export interface ActiveFestivals {
    festivals: unknown[];
}

/** GET /timeline */
export interface Timeline {
    onlineshop: {
        importance: number;
        merchandise: ShopMerchandise;
    };
    udemae: {
        importance: number;
    };
    coop: {
        importance: number;
        schedule: CoopSchedule;
        reward_gear: CoopRewardGear;
    };
    stats: {
        importance: number;
        recents: MatchResults[];
    };
    challenge: {
        next_challenge: Challenge;
        total_paint_point: number;
        importance: number;
        last_archived_challenge?: Challenge;
    };
    schedule: {
        schedules: {
            gachi: ScheduleItem[];
            league: ScheduleItem[];
            regular: ScheduleItem[];
        };
        importance: number;
    };
    weapon_availability: {
        availabilities: unknown[];
        importance: number;
    };
    fes_winners: {
        importance: number;
    };
    fes_event_match_result: {
        importance: number;
    };
    unique_id: string;
    download_contents: {
        is_available: boolean;
        importance: number;
    };
}

interface CoopRewardGear {
    available_time: number;
    gear: Gear;
}

/** GET /nickname_and_icon?id={...} */
export interface NicknameAndIcons {
    nickname_and_icons: NicknameAndIcon[];
}

export interface NicknameAndIcon {
    thumbnail_url: string;
    nickname: string;
    nsa_id: string;
}

/** GET /schedules */
export interface Schedules {
    regular: ScheduleItem[];
    league: ScheduleItem[];
    gachi: ScheduleItem[];
}

interface ScheduleItem {
    start_time: number;
    end_time: number;
    stage_b: Stage;
    rule: Rule;
    id: number;
    game_mode: GameMode;
    stage_a: Stage;
}

/** GET /records/hero */
export interface HeroRecords {
    stage_infos: StageInfo[];
    summary: HeroRecordsSummary;
    weapon_map: Record<string, HeroWeapon>;
}

interface HeroRecordsSummary {
    weapon_cleared_info: Record<string, boolean>;
    honor: HeroHonor;
    clear_rate: number;
}
interface HeroHonor {
    code: string;
    name: string;
}
interface StageInfo {
    clear_weapons: Record<string, StageCleared>;
    stage: HeroStage;
}
interface StageCleared {
    clear_time: number;
    weapon_category: string;
    weapon_level: number;
}
interface HeroStage {
    id: string;
    is_boss: boolean;
    area: string;
}
interface HeroWeapon {
    category: string;
    image: string;
}

/** GET /x_power_ranking/{season}/summary */
export interface XPowerRankingSummary {
    clam_blitz: XPowerRankingRecords;
    rainmaker: XPowerRankingRecords;
    tower_control: XPowerRankingRecords;
    splat_zones: XPowerRankingRecords;
}

/** GET /x_power_ranking/{season}/{rule} */
export interface XPowerRankingRecords {
    weapon_ranking: null;
    season_id: string;
    top_rankings_count: number;
    top_rankings: XPowerRankingRecordsRanking[];
    status: XPowerRankingStatus;
    rule: Rule;
    start_time: number;
    end_time: number;
    my_ranking: null;
}

export enum XPowerRankingStatus {
    CALCULATED = 'calculated',
    ONGOING = 'ongoing',
}
interface XPowerRankingRecordsRanking {
    name: string;
    principal_id: string;
    weapon: Weapon;
    rank: number;
    unique_id: string;
    x_power: number;
    rank_change: null;
    cheater: boolean;
}

/** GET /festivals/pasts */
export interface PastFestivals {
    festivals: Festival[];
    results: FestivalResults[];
}

interface Festival {
    colors: FestivalInkColours;
    festival_id: number;
    names: FestivalTeamNames;
    images: FestivalImages;
    times: FestivalTimes;
    special_stage: Stage;
}

interface FestivalTeamNames {
    bravo_short: string;
    bravo_long: string;
    alpha_short: string;
    alpha_long: string;
}
interface FestivalImages {
    bravo: string;
    alpha: string;
    panel: string;
}
interface FestivalTimes {
    start: number;
    announce: number;
    end: number;
    result: number;
}
interface FestivalInkColours {
    middle: InkColour;
    bravo: InkColour;
    alpha: InkColour;
}

interface InkColour {
    g: number;
    a: number;
    r: number;
    b: number;
    css_rgb: string;
}

type FestivalResults = FestivalResults1 | FestivalResults2;
interface FestivalResults2 {
    contribution_alpha: FestivalResultsContribution;
    contribution_bravo: FestivalResultsContribution;
    rates: {
        regular: FestivalResultsRates;
        challenge: FestivalResultsRates;
        vote: FestivalResultsRates;
    },
    festival_version: 2;
    summary: {
        regular: number;
        challenge: number;
        total: number;
        vote: number;
    };
    festival_id: number;
}
interface FestivalResultsContribution {
    regular: number;
    challenge: number;
}
interface FestivalResultsRates {
    alpha: number;
    bravo: number;
}
interface FestivalResults1 {
    festival_id: number;
    summary: {
        team: number;
        vote: number;
        total: number;
        solo: number;
    },
    festival_version: 1;
    rates: {
        team: FestivalResultsRates;
        solo: FestivalResultsRates;
        vote: FestivalResultsRates;
    };
}

/** GET /league_match_ranking/{league}/{region} */
export interface LeagueMatchRankings {
    start_time: number;
    league_type: LeagueType;
    league_ranking_region: LeagueRankingRegion;
    rankings: LeagueMatchRanking[];
    league_id: string;
}

interface LeagueType {
    key: string; // "team", "pair"
    name: string; // "Mode: Team", "Mode: Pair"
}
interface LeagueRankingRegion {
    id: number; // 0, 1, 2, 4
    code: string; // ALL, JP, US, EU
}
interface LeagueMatchRanking {
    tag_members: LeagueTagMember[];
    point: number;
    tag_id: string;
    cheater: boolean;
    rank: number;
}
interface LeagueTagMember {
    weapon: Weapon;
    unique_id: string;
    principal_id: string;
}

/** GET /results */
export interface Results {
    results: MatchResults[];
    unique_id: string;
    summary: ResultsSummary;
}

interface ResultsSummary {
    kill_count_average: number;
    victory_count: number;
    count: number;
    defeat_count: number;
    special_count_average: number;
    victory_rate: number;
    death_count_average: number;
    assist_count_average: number;
}

type MatchResults = RegularMatchResults | RankedMatchResults;
interface BaseMatchResults {
    battle_number: string;
    type: string;
    start_time: number;
    player_result: PlayerResult;
    rule: Rule;
    star_rank: number;
    stage: Stage;
    other_team_result: TeamResult;
    weapon_paint_point: number;
    player_rank: number;
    game_mode: GameMode;
    my_team_result: TeamResult;
}
interface RegularMatchResults extends BaseMatchResults {
    type: 'regular';
    my_team_percentage: number;
    other_team_percentage: number;
    win_meter: number;
}
interface RankedMatchResults extends BaseMatchResults {
    type: 'gachi';
    player_result: SelfRankedPlayerResult;
    my_team_count: number;
    other_team_count: number;
    estimate_x_power: null;
    elapsed_time: number;
    rank: null;
    crown_players: null;
    udemae: {
        is_x: boolean;
        is_number_reached: boolean;
        s_plus_number: null;
        name: null;
        number: number;
    };
    estimate_gachi_power: null;
    x_power: null;
}
interface PlayerResult {
    kill_count: number;
    death_count: number;
    player: Omit<Player, 'max_league_point_team' | 'udemae_tower' | 'udemae_clam' | 'udemae_rainmaker' | 'max_league_point_pair' | 'udemae_zones'>;
    special_count: number;
    assist_count: number;
    sort_score: number;
    game_paint_point: number;
}
interface RankedPlayerResult extends PlayerResult {
    player: PlayerResult['player'] & {
        udemae: {
            name: null;
            s_plus_number: null;
            is_x: boolean;
        };
    };
}
interface SelfRankedPlayerResult extends PlayerResult {
    player: PlayerResult['player'] & {
        udemae: {
            name: null;
            s_plus_number: null;
            number: number; // -1;
            is_number_reached: boolean;
            is_x: boolean;
        };
    };
}
interface Rule {
    multiline_name: string;
    name: string;
    key: string;
}
interface GameMode {
    key: string;
    name: string;
}
interface TeamResult {
    key: 'victory' | 'defeat';
    name: string;
}

/** GET /results/1 */
export type Result = RegularResult | RankedResult;
export interface RegularResult extends RegularMatchResults {
    other_team_members: PlayerResult[];
    my_team_members: PlayerResult[];
}
export interface RankedResult extends RankedMatchResults {
    other_team_members: RankedPlayerResult[];
    my_team_members: RankedPlayerResult[];
}

/** GET /coop_results */
export interface CoopResults {
    results: CoopResultsResult[];
    summary: {
        stats: CoopSummaryResult[];
        card: CoopSummaryCard;
    };
    reward_gear: Gear;
}

interface CoopResultsResult {
    grade_point: number;
    job_score: number;
    my_result: CoopPlayerResult;
    grade: CoopGrade;
    job_rate: number;
    job_id: number;
    start_time: number;
    boss_counts: Record<string, CoopBossCount>;
    end_time: number;
    danger_rate: number;
    play_time: number;
    player_type: PlayerType;
    job_result: CoopJobResult;
    schedule: CoopSchedule;
    wave_details: CoopWave[];
    kuma_point: number;
    grade_point_delta: number;
}

interface CoopPlayerResult {
    special: SpecialWeapon;
    name: string;
    help_count: number;
    golden_ikura_num: number;
    dead_count: number;
    pid: string;
    boss_kill_counts: Record<string, CoopBossCount>;
    weapon_list: CoopWeapon[];
    ikura_num: number;
    special_counts: number[];
    player_type: PlayerType;
}
interface CoopGrade {
    id: string;
    long_name: string;
    short_name: string;
    name: string;
}
interface CoopBossCount {
    boss: CoopBoss;
    count: number;
}
interface CoopBoss {
    name: string;
    key: string;
}
type CoopJobResult = CoopJobResultSuccess | CoopJobResultFailure;
interface CoopJobResultSuccess {
    is_clear: true;
    failure_reason: null;
    failure_wave: null;
}
interface CoopJobResultFailure {
    failure_wave: number;
    failure_reason: string;
    is_clear: false;
}
interface CoopWave {
    ikura_num: number;
    event_type: CoopWaveType;
    golden_ikura_num: number;
    golden_ikura_pop_num: number;
    water_level: CoopWaveWaterLevel;
    quota_num: number;
}
interface CoopWaveType {
    name: string;
    key: string;
}
interface CoopWaveWaterLevel {
    key: string;
    name: string;
}
type CoopWeapon = CoopStandardWeapon | CoopSpecialWeapon;
interface CoopStandardWeapon {
    weapon: Omit<Weapon, 'sub' | 'special'>;
    id: string;
}
interface CoopSpecialWeapon {
    id: string;
    coop_special_weapon: {
        image: string;
        name: string;
    };
}

interface CoopSummaryResult {
    schedule: CoopSchedule;
    my_ikura_total: number;
    kuma_point_total: number;
    clear_num: number;
    end_time: number;
    job_num: number;
    team_golden_ikura_total: number;
    failure_counts: number[];
    grade: {
        id: string;
        name: string;
    };
    team_ikura_total: number;
    help_total: number;
    start_time: number;
    dead_total: number;
    grade_point: number;
    my_golden_ikura_total: number;
}
interface CoopSummaryCard {
    kuma_point_total: number;
    golden_ikura_total: number;
    help_total: number;
    ikura_total: number;
    kuma_point: number;
    job_num: number;
}

/** GET /coop_results/1 */
export interface CoopResult extends CoopResultsResult {
    other_results: CoopPlayerResult[];
}

/** GET /coop_schedules */
export interface CoopSchedules {
    details: CoopSchedule[];
    schedules: CoopScheduleTimes[];
}

interface CoopSchedule {
    weapons: CoopWeapon[];
    stage: {
        image: string;
        name: string;
    };
    start_time: number;
    end_time: number;
}
interface CoopScheduleTimes {
    start_time: number;
    end_time: number;
}

/** GET /onlineshop/merchandises */
export interface ShopMerchandises {
    merchandises: ShopMerchandise[];
    ordered_info: null;
}

interface ShopMerchandise {
    skill: Skill;
    end_time: number;
    gear: Gear;
    id: string;
    price: number;
    kind: GearType;
}

/** POST /share/profile, POST /share/results/summary, POST /share/results/1 */
export interface ShareResponse {
    url: string;
    hashtags: string[];
    text: string;
}

export interface ResultWithPlayerNicknameAndIcons {
    result: Result;
    nickname_and_icons: NicknameAndIcon[];
}
export interface CoopResultWithPlayerNicknameAndIcons {
    result: CoopResult;
    nickname_and_icons: NicknameAndIcon[];
}
