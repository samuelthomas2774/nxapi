export { default as CoralApi } from './api/coral.js';
export { /** @deprecated */ default as ZncApi } from './api/coral.js';
export { default as ZncProxyApi } from './api/znc-proxy.js';
export * as coral from './api/coral-types.js';
/** @deprecated */
export * as znc from './api/coral-types.js';
export { default as MoonApi } from './api/moon.js';
export * as moon from './api/moon-types.js';
export * as na from './api/na.js';
export * as f from './api/f.js';

export {
    default as SplatNet2Api,
    LeagueType as SplatNet2LeagueType,
    LeagueRegion as SplatNet2LeagueRegion,
    ShareColour as SplatNet2ProfileColour,
    toLeagueId as toSplatNet2LeagueId,
} from './api/splatnet2.js';
export {
    Season as SplatNet2XRankSeason,
    Rule as SplatNet2XPowerRankingRule,
    getAllSeasons as getSplatNet2XRankSeasons,
    getSeason as getSplatNet2XRankSeason,
    getNextSeason as getSplatNet2NextXRankSeason,
    getPreviousSeason as getSplatNet2PreviousXRankSeason,
    toSeasonId as toSplatNet2XRankSeasonId,
} from './api/splatnet2-xrank.js';
export * as splatnet2 from './api/splatnet2-types.js';
export {
    default as NooklinkApi,
    NooklinkUserApi,
    MessageType as NooklinkMessageType,
} from './api/nooklink.js';
export * as nooklink from './api/nooklink-types.js';

export { getTitleIdFromEcUrl } from './util/misc.js';
export { ErrorResponse } from './api/util.js';
export { addUserAgent } from './util/useragent.js';
