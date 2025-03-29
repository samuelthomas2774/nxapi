import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fetch, Headers } from 'undici';
import { defineResponse, ErrorResponse } from './util.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';
import { ZNCA_VERSION } from './coral.js';

const debugFlapg = createDebug('nxapi:api:flapg');
const debugImink = createDebug('nxapi:api:imink');
const debugZncaApi = createDebug('nxapi:api:znca-api');

export abstract class ZncaApi {
    constructor(
        public useragent?: string
    ) {}

    abstract genf(
        token: string, hash_method: HashMethod,
        user?: {na_id: string; coral_user_id?: string;},
    ): Promise<FResult>;
}

export enum HashMethod {
    CORAL = 1,
    WEB_SERVICE = 2,
}

//
// flapg
//

export async function flapg(
    hash_method: HashMethod, token: string,
    timestamp?: string | number, request_id?: string,
    useragent?: string
) {
    const { default: { coral_auth: { flapg: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents flapg API use');

    debugFlapg('Getting f parameter', {
        hash_method, token, timestamp, request_id,
    });

    const req: FlapgApiRequest = {
        hash_method: '' + hash_method as `${HashMethod}`,
        token,
        timestamp: typeof timestamp === 'number' ? '' + timestamp : undefined,
        request_id,
    };

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://flapg.com/ika/api/login-main', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': getUserAgent(useragent),
        },
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw await ErrorResponse.fromResponse(response, '[flapg] Non-200 status code');
    }

    const data = await response.json() as FlapgApiResponse;

    debugFlapg('Got f parameter', data);

    return defineResponse(data, response);
}

/** @deprecated */
export enum FlapgIid {
    /** Nintendo Switch Online app token */
    NSO = 'nso',
    /** Web service token */
    APP = 'app',
}

export interface FlapgApiRequest {
    hash_method: '1' | '2';
    token: string;
    timestamp?: string;
    request_id?: string;
}

export type FlapgApiResponse = IminkFResponse;
export type FlapgApiError = IminkFError;

export class ZncaApiFlapg extends ZncaApi {
    async genf(token: string, hash_method: HashMethod) {
        const request_id = randomUUID();

        const result = await flapg(hash_method, token, undefined, request_id, this.useragent);

        return {
            provider: 'flapg' as const,
            hash_method, token, request_id,
            timestamp: result.timestamp,
            f: result.f,
            result,
        };
    }
}

//
// imink
//

export async function iminkf(
    hash_method: HashMethod, token: string,
    timestamp?: number, request_id?: string,
    user?: {na_id: string; coral_user_id?: string;},
    useragent?: string,
) {
    const { default: { coral_auth: { imink: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents imink API use');

    debugImink('Getting f parameter', {
        hash_method, token, timestamp, request_id,
    });

    const req: IminkFRequest = {
        hash_method,
        token,
        timestamp: typeof timestamp === 'number' ? '' + timestamp : undefined,
        request_id,
        ...user,
    };

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://api.imink.app/f', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': getUserAgent(useragent),
        },
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw await ErrorResponse.fromResponse(response, '[imink] Non-200 status code');
    }

    const data = await response.json() as IminkFResponse | IminkFError;

    if ('error' in data) {
        throw new ErrorResponse('[imink] ' + data.reason, response, data);
    }

    debugImink('Got f parameter "%s"', data.f);

    return defineResponse(data, response);
}

export interface IminkFRequest {
    hash_method: 1 | 2 | '1' | '2';
    token: string;
    timestamp?: string | number;
    request_id?: string;
}
export interface IminkFResponse {
    f: string;
    timestamp: number;
    request_id: string;
}
export interface IminkFError {
    reason: string;
    error: true;
}

export class ZncaApiImink extends ZncaApi {
    async genf(token: string, hash_method: HashMethod, user?: {na_id: string; coral_user_id?: string;}) {
        const request_id = randomUUID();

        const result = await iminkf(hash_method, token, undefined, request_id, user, this.useragent);

        return {
            provider: 'imink' as const,
            hash_method, token, request_id,
            timestamp: result.timestamp,
            f: result.f,
            user,
            result,
        };
    }
}

//
// nxapi znca API server
//

export async function genf(
    url: string, hash_method: HashMethod,
    token: string, timestamp?: number, request_id?: string,
    user?: {na_id: string; coral_user_id?: string;},
    app?: {platform?: string; version?: string;},
    useragent?: string,
) {
    debugZncaApi('Getting f parameter', {
        url, hash_method, token, timestamp, request_id, user,
        znca_platform: app?.platform, znca_version: app?.version,
    });

    const req: AndroidZncaFRequest = {
        hash_method: '' + hash_method as `${HashMethod}`,
        token,
        timestamp,
        request_id,
        ...user,
    };

    const headers = new Headers({
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(useragent),
    });
    if (app?.platform) headers.append('X-znca-Platform', app.platform);
    if (app?.version) headers.append('X-znca-Version', app.version);
    if (ZNCA_VERSION) headers.append('X-znca-Client-Version', ZNCA_VERSION);

    const [signal, cancel] = timeoutSignal();
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw await ErrorResponse.fromResponse(response, '[znca-api] Non-200 status code');
    }

    const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

    if ('error' in data) {
        debugZncaApi('Error getting f parameter "%s"', data.error);
        throw new ErrorResponse<AndroidZncaFError>('[znca-api] ' + (data.error_message ?? data.error), response, data);
    }

    debugZncaApi('Got f parameter', data, response.headers);

    return defineResponse(data, response);
}

export interface AndroidZncaFRequest {
    hash_method: '1' | '2';
    token: string;
    timestamp?: string | number;
    request_id?: string;
}
export interface AndroidZncaFResponse {
    f: string;
    timestamp?: number;
    request_id?: string;

    warnings?: {error: string; error_message: string}[];
}
export interface AndroidZncaFError {
    error: string;
    error_message?: string;

    errors?: {error: string; error_message: string}[];
    warnings?: {error: string; error_message: string}[];
}

export class ZncaApiNxapi extends ZncaApi {
    constructor(readonly url: string, readonly app?: {platform?: string; version?: string;}, useragent?: string) {
        super(useragent);
    }

    async genf(token: string, hash_method: HashMethod, user?: {na_id: string; coral_user_id?: string}) {
        // const request_id = randomUUID();

        const result = await genf(this.url + '/f', hash_method, token, undefined, undefined,
            user, this.app, this.useragent);

        return {
            provider: 'nxapi' as const,
            url: this.url + '/f',
            hash_method, token,
            timestamp: result.timestamp!, // will be included as not sent in request
            request_id: result.request_id!,
            f: result.f,
            user,
            result,
        };
    }
}

export async function f(token: string, hash_method: HashMethod | `${HashMethod}`, options?: ZncaApiOptions): Promise<FResult>;
export async function f(token: string, hash_method: HashMethod | `${HashMethod}`, useragent?: string): Promise<FResult>;
export async function f(token: string, hash_method: HashMethod | `${HashMethod}`, options?: ZncaApiOptions | string): Promise<FResult> {
    if (typeof options === 'string') options = {useragent: options};
    if (typeof hash_method === 'string') hash_method = parseInt(hash_method);

    const provider = getPreferredZncaApiFromEnvironment(options) ?? await getDefaultZncaApi(options);

    return provider.genf(token, hash_method, options?.user);
}

export type FResult = {
    provider: string;
    hash_method: HashMethod;
    token: string;
    timestamp: number;
    request_id: string;
    f: string;
    user?: {na_id: string; coral_user_id?: string;};
    result: unknown;
} & ({
    provider: 'flapg';
    result: FlapgApiResponse;
} | {
    provider: 'imink';
    result: IminkFResponse;
} | {
    provider: 'nxapi';
    url: string;
    result: AndroidZncaFResponse;
});

interface ZncaApiOptions {
    useragent?: string;
    platform?: string;
    version?: string;
    user?: {na_id: string; coral_user_id?: string;};
}

export function getPreferredZncaApiFromEnvironment(options?: ZncaApiOptions): ZncaApi | null;
export function getPreferredZncaApiFromEnvironment(useragent?: string): ZncaApi | null;
export function getPreferredZncaApiFromEnvironment(options?: ZncaApiOptions | string): ZncaApi | null {
    if (typeof options === 'string') options = {useragent: options};

    if (process.env.NXAPI_ZNCA_API) {
        if (process.env.NXAPI_ZNCA_API === 'flapg') {
            return new ZncaApiFlapg(options?.useragent);
        }
        if (process.env.NXAPI_ZNCA_API === 'imink') {
            return new ZncaApiImink(options?.useragent);
        }

        throw new Error('Unknown znca API provider');
    }

    if (process.env.ZNCA_API_URL) {
        return new ZncaApiNxapi(process.env.ZNCA_API_URL, options, options?.useragent);
    }

    return null;
}

export async function getDefaultZncaApi(options?: ZncaApiOptions): Promise<ZncaApi>;
export async function getDefaultZncaApi(useragent?: string): Promise<ZncaApi>;
export async function getDefaultZncaApi(options?: ZncaApiOptions | string) {
    if (typeof options === 'string') options = {useragent: options};

    const { default: { coral_auth: { default: provider } } } = await import('../common/remote-config.js');

    if (provider === 'flapg') {
        return new ZncaApiFlapg(options?.useragent);
    }
    if (provider === 'imink') {
        return new ZncaApiImink(options?.useragent);
    }

    if (provider[0] === 'nxapi') {
        return new ZncaApiNxapi(provider[1], options, options?.useragent);
    }

    throw new Error('Invalid znca API provider');
}
