import process from 'node:process';
import fetch from 'node-fetch';
import createDebug from 'debug';
import { v4 as uuidgen } from 'uuid';
import { defineResponse, ErrorResponse } from './util.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';

const debugS2s = createDebug('nxapi:api:s2s');
const debugFlapg = createDebug('nxapi:api:flapg');
const debugImink = createDebug('nxapi:api:imink');
const debugZncaApi = createDebug('nxapi:api:znca-api');

export abstract class ZncaApi {
    constructor(
        public useragent?: string
    ) {}

    abstract genf(token: string, hash_method: HashMethod): Promise<FResult>;
}

export enum HashMethod {
    CORAL = 1,
    WEB_SERVICE = 2,
}

//
// flapg
//

/** @deprecated The flapg API no longer requires client authentication */
export async function getLoginHash(token: string, timestamp: string | number, useragent?: string) {
    const { default: { coral_auth: { splatnet2statink: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents splatnet2statink API use');

    debugS2s('Getting login hash');

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://elifessler.com/s2s/api/gen2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': getUserAgent(useragent),
        },
        body: new URLSearchParams({
            naIdToken: token,
            timestamp: '' + timestamp,
        }).toString(),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse('[s2s] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as LoginHashApiResponse | LoginHashApiError;

    if ('error' in data) {
        throw new ErrorResponse('[s2s] ' + data.error, response, data);
    }

    debugS2s('Got login hash "%s"', data.hash, data);

    return data.hash;
}

export interface LoginHashApiResponse {
    hash: string;
}
export interface LoginHashApiError {
    error: string;
}

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
        throw new ErrorResponse<FlapgApiError>('[flapg] Non-200 status code', response, await response.text());
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
    /** @deprecated */
    async getLoginHash(id_token: string, timestamp: string) {
        return getLoginHash(id_token, timestamp, this.useragent);
    }

    async genf(token: string, hash_method: HashMethod) {
        const request_id = uuidgen();

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
    useragent?: string
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
        throw new ErrorResponse<IminkFError>('[imink] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as IminkFResponse | IminkFError;

    if ('error' in data) {
        throw new ErrorResponse<IminkFError>('[imink] ' + data.reason, response, data);
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
    async genf(token: string, hash_method: HashMethod) {
        const request_id = uuidgen();

        const result = await iminkf(hash_method, token, undefined, request_id, this.useragent);

        return {
            provider: 'imink' as const,
            hash_method, token, request_id,
            timestamp: result.timestamp,
            f: result.f,
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
    useragent?: string
) {
    debugZncaApi('Getting f parameter', {
        url, hash_method, token, timestamp, request_id,
    });

    const req: AndroidZncaFRequest = {
        hash_method: '' + hash_method as `${HashMethod}`,
        token,
        timestamp,
        request_id,
    };

    const [signal, cancel] = timeoutSignal();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': getUserAgent(useragent),
        },
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse<AndroidZncaFError>('[znca-api] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

    if ('error' in data) {
        debugZncaApi('Error getting f parameter "%s"', data.error);
        throw new ErrorResponse<AndroidZncaFError>('[znca-api] ' + data.error_message ?? data.error, response, data);
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
}
export interface AndroidZncaFError {
    error: string;
    error_message?: string;
}

export class ZncaApiNxapi extends ZncaApi {
    constructor(readonly url: string, useragent?: string) {
        super(useragent);
    }

    async genf(token: string, hash_method: HashMethod) {
        const request_id = uuidgen();

        const result = await genf(this.url + '/f', hash_method, token, undefined, request_id, this.useragent);

        return {
            provider: 'nxapi' as const,
            url: this.url + '/f',
            hash_method, token, request_id,
            timestamp: result.timestamp!, // will be included as not sent in request
            f: result.f,
            result,
        };
    }
}

export async function f(token: string, hash_method: HashMethod | `${HashMethod}`, useragent?: string): Promise<FResult> {
    if (typeof hash_method === 'string') hash_method = parseInt(hash_method);

    const provider = getPreferredZncaApiFromEnvironment(useragent) ?? await getDefaultZncaApi(useragent);

    return provider.genf(token, hash_method);
}

export type FResult = {
    provider: string;
    hash_method: HashMethod;
    token: string;
    timestamp: number;
    request_id: string;
    f: string;
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

export function getPreferredZncaApiFromEnvironment(useragent?: string): ZncaApi | null {
    if (process.env.NXAPI_ZNCA_API) {
        if (process.env.NXAPI_ZNCA_API === 'flapg') {
            return new ZncaApiFlapg(useragent);
        }
        if (process.env.NXAPI_ZNCA_API === 'imink') {
            return new ZncaApiImink(useragent);
        }

        throw new Error('Unknown znca API provider');
    }

    if (process.env.ZNCA_API_URL) {
        return new ZncaApiNxapi(process.env.ZNCA_API_URL, useragent);
    }

    return null;
}

export async function getDefaultZncaApi(useragent?: string) {
    const { default: { coral_auth: { default: provider } } } = await import('../common/remote-config.js');

    if (provider === 'flapg') {
        return new ZncaApiFlapg(useragent);
    }
    if (provider === 'imink') {
        return new ZncaApiImink(useragent);
    }

    if (provider[0] === 'nxapi') {
        return new ZncaApiNxapi(provider[1], useragent);
    }

    throw new Error('Invalid znca API provider');
}
