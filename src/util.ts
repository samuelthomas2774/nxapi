import * as path from 'path';
import * as yargs from 'yargs';
import type * as yargstypes from '../node_modules/@types/yargs/index.js';
import createDebug from 'debug';
import persist from 'node-persist';
import getPaths from 'env-paths';
import fetch from 'node-fetch';
import { FlapgApiResponse } from './api/f.js';
import { NintendoAccountSessionTokenJwtPayload, NintendoAccountToken, NintendoAccountUser } from './api/na.js';
import { AccountLogin } from './api/znc-types.js';
import ZncApi, { ZNCA_CLIENT_ID } from './api/znc.js';
import ZncProxyApi from './api/znc-proxy.js';
import MoonApi, { ZNMA_CLIENT_ID } from './api/moon.js';
import { Jwks, Jwt } from './api/util.js';

const debug = createDebug('cli');

export const paths = getPaths('nxapi');

export type YargsArguments<T extends yargs.Argv> = T extends yargs.Argv<infer R> ? R : any;
export type Argv<T = {}> = yargs.Argv<T>;
export type ArgumentsCamelCase<T = {}> = yargstypes.ArgumentsCamelCase<T>;

export interface SavedToken {
    uuid: string;
    timestamp: string;
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;
    flapg: FlapgApiResponse['result'];
    nsoAccount: AccountLogin;
    credential: AccountLogin['webApiServerCredential'];

    expires_at: number;
    proxy_url?: string;
}

export interface SavedMoonToken {
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;

    expires_at: number;
}

export async function initStorage(dir: string) {
    const storage = persist.create({
        dir: path.join(dir, 'persist'),
        stringify: data => JSON.stringify(data, null, 4) + '\n',
    });
    await storage.init();
    return storage;
}

export async function getToken(storage: persist.LocalStorage, token: string, proxy_url: string): Promise<{
    nso: ZncProxyApi;
    data: SavedToken;
}>
export async function getToken(storage: persist.LocalStorage, token: string, proxy_url?: string): Promise<{
    nso: ZncApi;
    data: SavedToken;
}>
export async function getToken(storage: persist.LocalStorage, token: string, proxy_url?: string) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi nso token`.');
        throw new Error('Invalid token');
    }

    const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

    if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
        throw new Error('Invalid Nintendo Account session token issuer');
    }
    if (jwt.payload.typ !== 'session_token') {
        throw new Error('Invalid Nintendo Account session token type');
    }
    if (jwt.payload.aud !== ZNCA_CLIENT_ID) {
        throw new Error('Invalid Nintendo Account session token audience');
    }
    if (jwt.payload.exp <= (Date.now() / 1000)) {
        throw new Error('Nintendo Account session token expired');
    }

    // Nintendo Account session tokens use a HMAC SHA256 signature, so we can't verify this is valid

    const existingToken: SavedToken | undefined = await storage.getItem('NsoToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        console.warn('Authenticating to Nintendo Switch Online app');
        debug('Authenticating to znc with session token');

        const {nso, data} = proxy_url ?
            await ZncProxyApi.createWithSessionToken(proxy_url, token) :
            await ZncApi.createWithSessionToken(token);

        const existingToken: SavedToken = {
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        await storage.setItem('NsoToken.' + token, existingToken);
        await storage.setItem('NintendoAccountToken.' + data.user.id, token);

        return {nso, data: existingToken};
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken.' + existingToken.user.id, token);

    return {
        nso: proxy_url ?
            new ZncProxyApi(proxy_url, token) :
            new ZncApi(existingToken.credential.accessToken),
        data: existingToken,
    };
}

export async function getPctlToken(storage: persist.LocalStorage, token: string) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nxapi pctl auth`.');
        throw new Error('Invalid token');
    }

    const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

    if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
        throw new Error('Invalid Nintendo Account session token issuer');
    }
    if (jwt.payload.typ !== 'session_token') {
        throw new Error('Invalid Nintendo Account session token type');
    }
    if (jwt.payload.aud !== ZNMA_CLIENT_ID) {
        throw new Error('Invalid Nintendo Account session token audience');
    }
    if (jwt.payload.exp <= (Date.now() / 1000)) {
        throw new Error('Nintendo Account session token expired');
    }

    // Nintendo Account session tokens use a HMAC SHA256 signature, so we can't verify this is valid

    const existingToken: SavedMoonToken | undefined = await storage.getItem('MoonToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        console.warn('Authenticating to Nintendo Switch Parental Controls app');
        debug('Authenticating to pctl with session token');

        const {moon, data} = await MoonApi.createWithSessionToken(token);

        const existingToken: SavedMoonToken = {
            ...data,
            expires_at: Date.now() + (data.nintendoAccountToken.expires_in * 1000),
        };

        await storage.setItem('MoonToken.' + token, existingToken);
        await storage.setItem('NintendoAccountToken-pctl.' + data.user.id, token);

        return {moon, data: existingToken};
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken-pctl.' + existingToken.user.id, token);

    return {
        moon: new MoonApi(existingToken.nintendoAccountToken.access_token!, existingToken.user.id),
        data: existingToken,
    };
}

export function getTitleIdFromEcUrl(url: string) {
    const match = url.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);
    return match?.[1] ?? null;
}

export function hrduration(duration: number, short = false) {
    const hours = Math.floor(duration / 60);
    const minutes = duration - (hours * 60);

    const hour_str = short ? 'hr' : 'hour';
    const minute_str = short ? 'min' : 'minute';

    if (hours >= 1) {
        return hours + ' ' + hour_str + (hours === 1 ? '' : 's') +
            (minutes ? ', ' + minutes + ' ' + minute_str + (minutes === 1 ? '' : 's') : '');
    } else {
        return minutes + ' ' + minute_str + (minutes === 1 ? '' : 's');
    }
}

export abstract class Loop {
    update_interval = 60;

    init(): void | Promise<void> {}

    abstract update(): void | Promise<void>;

    async loopRun(): Promise<LoopResult> {
        try {
            await this.update();

            return LoopResult.OK;
        } catch (err) {
            return this.handleError(err as any);
        }
    }

    async handleError(err: Error): Promise<LoopResult> {
        throw err;
    }

    async loop() {
        const result = await this.loopRun();

        if (result === LoopResult.OK) {
            await new Promise(rs => setTimeout(rs, this.update_interval * 1000));
        }
    }
}

const LoopRunOk = Symbol('LoopRunOk');
const LoopRunOkSkipInterval = Symbol('LoopRunOkSkipInterval');

export enum LoopResult {
    OK = LoopRunOk as any,
    OK_SKIP_INTERVAL = LoopRunOkSkipInterval as any,
}

interface SavedJwks {
    jwks: Jwks;
    expires_at: number;
}

export async function getJwks(url: string, storage?: persist.LocalStorage) {
    const cached_keyset: SavedJwks | undefined = await storage?.getItem('Jwks.' + url);

    if (!cached_keyset || cached_keyset.expires_at <= Date.now()) {
        debug('Downloading JSON Web Key Set from %s', url);

        const response = await fetch(url);

        const jwks = await response.json() as Jwks;

        const cached_keyset: SavedJwks = {
            jwks,
            expires_at: Date.now() + (1 * 60 * 60 * 1000), // 1 hour
        };

        await storage?.setItem('Jwks.' + url, cached_keyset);

        return jwks;
    }

    return cached_keyset.jwks;
}
