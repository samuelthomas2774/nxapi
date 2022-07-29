export {
    default,
    CoralAuthData,
    PartialCoralAuthData,
} from '../api/coral.js';

export * from '../api/coral-types.js';

export { default as ZncProxyApi } from '../api/znc-proxy.js';

export {
    ZncaApi,
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
