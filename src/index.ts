export { default as ZncApi } from './api/znc.js';
export { default as ZncProxyApi } from './api/znc-proxy.js';
export * as znc from './api/znc-types.js';
export { default as MoonApi } from './api/moon.js';
export * as moon from './api/moon-types.js';
export * as na from './api/na.js';
export * as f from './api/f.js';

export {
    default as SplatNet2Api,
    XPowerRankingRule as SplatNet2XPowerRankingRule,
    LeagueType as SplatNet2LeagueType,
    LeagueRegion as SplatNet2LeagueRegion,
    ShareColour as SplatNet2ProfileColour,
} from './api/splatnet2.js';
export * as splatnet2 from './api/splatnet2-types.js';
export {
    default as NooklinkApi,
    NooklinkUserApi,
    MessageType as NooklinkMessageType,
} from './api/nooklink.js';
export * as nooklink from './api/nooklink-types.js';

export { getTitleIdFromEcUrl } from './util.js';
export { ErrorResponse } from './api/util.js';
