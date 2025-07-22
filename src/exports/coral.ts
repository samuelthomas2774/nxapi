export {
    default,
    CoralApiInterface,

    CoralAuthData,
    PartialCoralAuthData,

    ResponseDataSymbol,
    CorrelationIdSymbol,

    CoralErrorResponse,

    NintendoAccountUserCoral,
    NintendoAccountSessionAuthorisationCoral,
} from '../api/coral.js';

export * from '../api/coral-types.js';

export { default as ZncProxyApi } from '../api/znc-proxy.js';

export {
    ZncaApi,
    HashMethod,
    getPreferredZncaApiFromEnvironment,
    getDefaultZncaApi,
    f,

    ZncaApiFlapg,
    FlapgIid,
    FlapgApiResponse,

    ZncaApiImink,
    IminkFResponse,
    IminkFError,

    ZncaApiNxapi,
    AndroidZncaFResponse,
    AndroidZncaFError,
} from '../api/f.js';

export {
    /** @internal Testing */
    default as Coral,
} from '../client/coral.js';
