import process from 'node:process';
import fetch from 'node-fetch';
import createDebug from 'debug';
import { ErrorResponse } from './util.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';

const debugS2s = createDebug('nxapi:api:s2s');
const debugFlapg = createDebug('nxapi:api:flapg');
const debugImink = createDebug('nxapi:api:imink');
const debugZncaApi = createDebug('nxapi:api:znca-api');

abstract class ZncaApi {
    constructor(
        public useragent?: string
    ) {}

    abstract genf(token: string, timestamp: string, uuid: string, type: FlapgIid): Promise<FResult>;
}

//
// splatnet2statink + flapg
//

export async function getLoginHash(token: string, timestamp: string | number, useragent?: string) {
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

    async genf(token: string, timestamp: string, uuid: string, type: FlapgIid) {
        const result = await flapg(token, timestamp, uuid, type, this.useragent);

        return {
            provider: 'flapg' as const,
            token, timestamp, uuid, type,
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
    async genf(token: string, timestamp: string, uuid: string, type: FlapgIid) {
        const result = await iminkf(token, timestamp, uuid, type === FlapgIid.APP ? '2' : '1', this.useragent);

        return {
            provider: 'imink' as const,
            token, timestamp, uuid, type,
            f: result.f,
            result,
        };
    }
}

//
// nxapi znca API server
//

export async function genf(
    url: string, token: string, timestamp: string | number, uuid: string, type: FlapgIid,
    useragent?: string
) {
    debugZncaApi('Getting f parameter', {
        url, token, timestamp, uuid,
    });

    const req: AndroidZncaFRequest = {
        type,
        token,
        timestamp: '' + timestamp,
        uuid,
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

    const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

    if ('error' in data) {
        debugZncaApi('Error getting f parameter "%s"', data.error);
        throw new ErrorResponse('[znca-api] ' + data.error, response, data);
    }

    debugZncaApi('Got f parameter "%s"', data.f);

    return data;
}

export interface AndroidZncaFRequest {
    type: FlapgIid;
    token: string;
    timestamp: string;
    uuid: string;
}
export interface AndroidZncaFResponse {
    f: string;
}
export interface AndroidZncaFError {
    error: string;
}

export class ZncaApiNxapi extends ZncaApi {
    constructor(readonly url: string, useragent?: string) {
        super(useragent);
    }

    async genf(token: string, timestamp: string, uuid: string, type: FlapgIid) {
        const result = await genf(this.url + '/f', token, timestamp, uuid, type, this.useragent);

        return {
            provider: 'nxapi' as const,
            url: this.url + '/f',
            token, timestamp, uuid, type,
            f: result.f,
            result,
        };
    }
}

export async function f(
    token: string, timestamp: string | number, uuid: string, type: FlapgIid,
    useragent?: string
): Promise<FResult> {
    const provider = getZncaApiFromEnvironment(useragent);

    return provider.genf(token, '' + timestamp, uuid, type);
}

export type FResult = {
    provider: string;
    token: string;
    timestamp: string;
    uuid: string;
    type: FlapgIid;
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

function getZncaApiFromEnvironment(useragent?: string): ZncaApi {
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

    return new ZncaApiFlapg(useragent);
}
