export {
    default,
    SplatNet2AuthData,

    LeagueType,
    LeagueRegion,
    ShareColour as ShareProfileColour,
    toLeagueId,
} from '../api/splatnet2.js';

export {
    Season as XRankSeason,
    Rule as XPowerRankingRule,
    getAllSeasons as getXRankSeasons,
    getSeason as getXRankSeason,
    getNextSeason as getNextXRankSeason,
    getPreviousSeason as getPreviousXRankSeason,
    toSeasonId as toXRankSeasonId,
} from '../api/splatnet2-xrank.js';

export * from '../api/splatnet2-types.js';
