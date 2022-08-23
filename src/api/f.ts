import process from 'node:process';
import fetch from 'node-fetch';
import createDebug from 'debug';
import { v4 as uuidgen } from 'uuid';
import { ErrorResponse } from './util.js';
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

    abstract genf(token: string, hash_method: '1' | '2'): Promise<FResult>;
}

//
// splatnet2statink + flapg
//

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
    token: string, timestamp: string | number, guid: string, iid: FlapgIid,
    useragent?: string
) {
    const { default: { coral_auth: { flapg: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents flapg API use');

    const hash = await getLoginHash(token, timestamp, useragent);

    debugFlapg('Getting f parameter', {
        token, timestamp, guid, iid,
    });

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://flapg.com/ika2/api/login?public', {
        headers: {
            'User-Agent': getUserAgent(useragent),
            'x-token': token,
            'x-time': '' + timestamp,
            'x-guid': guid,
            'x-hash': hash,
            'x-ver': '3',
            'x-iid': iid,
        },
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw new ErrorResponse('[flapg] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as FlapgApiResponse;

    debugFlapg('Got f parameter "%s"', data.result.f);

    return data;
}

export enum FlapgIid {
    /** Nintendo Switch Online app token */
    NSO = 'nso',
    /** Web service token */
    APP = 'app',
}

export interface FlapgApiResponse {
    result: {
        f: string;
        p1: string;
        p2: string;
        p3: string;
    };
}

export class ZncaApiFlapg extends ZncaApi {
    async getLoginHash(id_token: string, timestamp: string) {
        return getLoginHash(id_token, timestamp, this.useragent);
    }

    async genf(token: string, hash_method: '1' | '2') {
        const timestamp = Date.now();
        const request_id = uuidgen();
        const type = hash_method === '2' ? FlapgIid.APP : FlapgIid.NSO;

        const result = await flapg(token, timestamp, request_id, type, this.useragent);

        return {
            provider: 'flapg' as const,
            token, timestamp, request_id, hash_method, type,
            f: result.result.f,
            result,
        };
    }
}

//
// imink
//

export async function iminkf(
    token: string, timestamp: string | number, uuid: string, hash_method: '1' | '2',
    useragent?: string
) {
    const { default: { coral_auth: { imink: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents imink API use');

    debugImink('Getting f parameter', {
        token, timestamp, uuid, hash_method,
    });

    const req: IminkFRequest = {
        hash_method,
        token,
        timestamp: '' + timestamp,
        request_id: uuid,
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
        throw new ErrorResponse('[imink] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as IminkFResponse | IminkFError;

    if ('error' in data) {
        throw new ErrorResponse('[imink] ' + data.reason, response, data);
    }

    debugImink('Got f parameter "%s"', data.f);

    return data;
}

export interface IminkFRequest {
    timestamp: string;
    request_id: string;
    hash_method: '1' | '2';
    token: string;
}
export interface IminkFResponse {
    f: string;
}
export interface IminkFError {
    reason: string;
    error: true;
}

export class ZncaApiImink extends ZncaApi {
    async genf(token: string, hash_method: '1' | '2') {
        const timestamp = Date.now();
        const request_id = uuidgen();

        const result = await iminkf(token, timestamp, request_id, hash_method, this.useragent);

        return {
            provider: 'imink' as const,
            token, timestamp, request_id, hash_method,
            f: result.f,
            result,
        };
    }
}

//
// nxapi znca API server
//

export async function genf(
    url: string, hash_method: '1' | '2',
    token: string, timestamp?: number, request_id?: string,
    useragent?: string
) {
    debugZncaApi('Getting f parameter', {
        url, token, timestamp, request_id,
    });

    const req: AndroidZncaFRequest = {
        hash_method,
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
        throw new ErrorResponse('[znca-api] Non-200 status code', response, await response.text());
    }

    const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

    if ('error' in data) {
        debugZncaApi('Error getting f parameter "%s"', data.error);
        throw new ErrorResponse('[znca-api] ' + data.error, response, data);
    }

    debugZncaApi('Got f parameter', data, response.headers);

    return data;
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
}

export class ZncaApiNxapi extends ZncaApi {
    constructor(readonly url: string, useragent?: string) {
        super(useragent);
    }

    async genf(token: string, hash_method: '1' | '2') {
        const result = await genf(this.url + '/f', hash_method, token, undefined, undefined, this.useragent);

        return {
            provider: 'nxapi' as const,
            url: this.url + '/f',
            token,
            timestamp: result.timestamp!, // will be included as not sent in request
            request_id: result.request_id!,
            hash_method,
            f: result.f,
            result,
        };
    }
}

export async function f(token: string, hash_method: '1' | '2', useragent?: string): Promise<FResult> {
    const provider = getPreferredZncaApiFromEnvironment(useragent) ?? await getDefaultZncaApi(useragent);

    return provider.genf(token, hash_method);
}

export type FResult = {
    provider: string;
    token: string;
    timestamp: number;
    request_id: string;
    hash_method: '1' | '2';
    f: string;
    result: unknown;
} & ({
    provider: 'flapg';
    type: FlapgIid;
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
