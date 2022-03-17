import fetch from 'node-fetch';
import createDebug from 'debug';
import { ErrorResponse } from './util.js';

const debugS2s = createDebug('api:s2s');
const debugFlapg = createDebug('api:flapg');
const debugZncaApi = createDebug('api:znca-api');

export async function getLoginHash(token: string, timestamp: string | number) {
    debugS2s('Getting login hash');

    const response = await fetch('https://elifessler.com/s2s/api/gen2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'discord-switch-presence/1.0.0',
        },
        body: new URLSearchParams({
            naIdToken: token,
            timestamp: '' + timestamp,
        }).toString(),
    });

    const data = await response.json() as LoginHashApiResponse | LoginHashApiError;

    if ('error' in data) {
        throw new ErrorResponse('[s2s] ' + data.error, response, data);
    }

    debugS2s('Got login hash "%s"', data.hash, data);

    return data.hash;
}

export async function flapg(token: string, timestamp: string | number, guid: string, iid: FlapgIid) {
    const hash = await getLoginHash(token, timestamp);

    debugFlapg('Getting f parameter', {
        token, timestamp, guid, iid,
    });

    const response = await fetch('https://flapg.com/ika2/api/login?public', {
        headers: {
            'x-token': token,
            'x-time': '' + timestamp,
            'x-guid': guid,
            'x-hash': hash,
            'x-ver': '3',
            'x-iid': iid,
        },
    });

    const data = await response.json() as FlapgApiResponse;

    debugFlapg('Got f parameter "%s"', data.result.f);

    return data.result;
}

export async function genf(url: string, token: string, timestamp: string | number, uuid: string, type: FlapgIid) {
    debugZncaApi('Getting f parameter', {
        url, token, timestamp, uuid,
    });

    const req: AndroidZncaFRequest = {
        type,
        token,
        timestamp: '' + timestamp,
        uuid,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
    });

    const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

    if ('error' in data) {
        debugZncaApi('Error getting f parameter "%s"', data.error);
        throw new ErrorResponse('[znca-api] ' + data.error, response, data);
    }

    debugZncaApi('Got f parameter "%s"', data.f);

    return data.f;
}

export async function genfc(url: string, token: string, timestamp: string | number, uuid: string, type: FlapgIid) {
    const f = await genf(url, token, timestamp, uuid, type);

    return {
        f,
        p1: token,
        p2: '' + timestamp,
        p3: uuid,

        url,
    };
}

export interface LoginHashApiResponse {
    hash: string;
}
export interface LoginHashApiError {
    error: string;
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
