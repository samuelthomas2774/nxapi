export {
    default,
    SplatNet3AuthData,
    SplatNet3CliTokenData,

    RequestIdSymbol,
    VariablesSymbol,

    SplatNet3ErrorResponse,
    SplatNet3AuthErrorResponse,
    SplatNet3GraphQLErrorResponse,
    SplatNet3GraphQLResourceNotFoundResponse,

    XRankingRegion,
    XRankingLeaderboardType,
    XRankingLeaderboardRule,
} from '../api/splatnet3.js';

// export * from '../api/splatnet3-types.js';

export {
    default as SplatNet3,
} from '../client/splatnet3.js';
