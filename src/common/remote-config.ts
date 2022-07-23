import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import fetch from 'node-fetch';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import { ErrorResponse } from '../api/util.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';
import { paths } from '../util/storage.js';
import { dev, dir, git, version } from '../util/product.js';

const debug = createDebug('nxapi:remote-config');

const CONFIG_URL = 'https://nxapi.ta.fancy.org.uk/data/config.json';
/** Maximum time in seconds to consider cached data fresh */
const MAX_FRESH = 24 * 60 * 60; // 1 day in seconds
/** Maximum time in seconds to allow using cached data after it's considered stale */
const MAX_STALE = 24 * 60 * 60; // 1 day in seconds

const default_config: NxapiRemoteConfig = {
    require_version: [version],
    ...JSON.parse(await fs.readFile(path.join(dir, 'resources', 'common', 'remote-config.json'), 'utf-8')),
};

async function loadRemoteConfig() {
    await mkdirp(paths.cache);
    const config_cache_path = path.resolve(paths.cache, 'config.json');

    const url = process.env.NXAPI_CONFIG_URL ?? CONFIG_URL;

    let data: RemoteConfigCacheData | undefined = undefined;
    let must_revalidate = true;

    try {
        data = JSON.parse(await fs.readFile(config_cache_path, 'utf-8'));

        if (data && (data.stale_at ?? data.expires_at) > Date.now()) {
            // Response is still fresh
            return data;
        }

        if (data && data.expires_at > Date.now()) {
            // Response is stale, but not expired
            must_revalidate = false;
        }
    } catch (err) {}

    try {
        const config = await getRemoteConfig(url, undefined, data ? {
            previous: data.data,
            updated_at: new Date(data.updated_at),
            etag: data.etag,
        } : undefined);
        const response = config[ResponseSymbol];

        const cache_directives = (response.headers.get('Cache-Control') ?? '')
            .split(',').map(d => d.trim().toLowerCase()).filter(d => d);
        const max_age_directive = cache_directives.find(d => d.startsWith('max-age='))?.substr(8);
        const max_age = max_age_directive ? Math.min(parseInt(max_age_directive), MAX_FRESH) : null;
        const stale_ie_directive = cache_directives.find(d => d.startsWith('stale-if-error='))?.substr(15);
        const stale_ie = stale_ie_directive ? Math.min(parseInt(stale_ie_directive), MAX_STALE) : null;

        const stale_at = max_age ? Date.now() + (max_age * 1000) : null;
        const expires_at =
            cache_directives.includes('no-store') || cache_directives.includes('no-cache') ? 0 :
            stale_ie && max_age ? Date.now() + (max_age * 1000) + (stale_ie * 1000) :
            stale_at ?? 0;

        const new_cache: RemoteConfigCacheData = {
            created_at: config[CachedSymbol] ? data!.created_at : Date.now(),
            updated_at: new Date(response.headers.get('Last-Modified') ?? Date.now()).getTime(),
            etag: response.headers.get('ETag'),
            revalidated_at: config[CachedSymbol] ? Date.now() : null,
            stale_at,
            expires_at,
            url: response.url,
            headers: response.headers.raw(),
            data: config,
        };

        await fs.writeFile(config_cache_path, JSON.stringify(new_cache, null, 4) + '\n', 'utf-8');
        return new_cache;
    } catch (err) {
        // Throw if the data was never loaded or has expired
        if (!data || must_revalidate) throw err;
        return data;
    }
}

const ResponseSymbol = Symbol('Response');
const CachedSymbol = Symbol('Cached');

async function getRemoteConfig(url: string, useragent?: string, cache?: {
    previous: NxapiRemoteConfig;
    updated_at: Date;
    etag: string | null;
}) {
    debug('Getting remote config from %s', url);

    const [signal, cancel] = timeoutSignal();
    const response = await fetch(url, {
        headers: {
            'User-Agent': getUserAgent(),
            'X-nxapi-Version': version,
            'X-nxapi-Revision': git?.revision ?? undefined!,
            'If-Modified-Since': cache ? cache.updated_at.toUTCString() : undefined!,
            'If-None-Match': cache?.etag ?? undefined!,
        },
        signal,
    }).finally(cancel);

    if (cache && response.status === 304) {
        return Object.assign({}, cache.previous, {
            [ResponseSymbol]: response,
            [CachedSymbol]: true,
        });
    }

    if (response.status !== 200) {
        throw new ErrorResponse('[nxapi] Unknown error', response, await response.text());
    }

    const config = await response.json() as NxapiRemoteConfig;

    debug('Got remote config', config);

    return Object.assign(config, {
        [ResponseSymbol]: response,
        [CachedSymbol]: false,
    });
}

async function tryLoadRemoteConfig() {
    try {
        return await loadRemoteConfig();
    } catch (err) {
        console.warn('Failed to load remote configuration; falling back to default configuration', err);
        return null;
    }
}

const debug_fixed_config: NxapiRemoteConfig | null =
    !dev ? null :
    await fs.readFile(path.join(paths.data, 'remote-config.json'), 'utf-8').then(JSON.parse).catch(err => {
        if (err.code === 'ENOENT') return null;

        debug('Error reading local debug config');
        console.warn('Error reading local debug configuration', err);
        return null;
    }) || null;

export enum RemoteConfigMode {
    /** Always use local configuration */
    DISABLE,
    /** Always use remote configuration */
    REQUIRE,
    /** Try to use remote configuration, but allow falling back to local configuration */
    OPPORTUNISTIC,
}

export const mode =
    process.env.NXAPI_ENABLE_REMOTE_CONFIG !== '1' ? RemoteConfigMode.DISABLE :
    process.env.NXAPI_REMOTE_CONFIG_FALLBACK === '1' ? RemoteConfigMode.OPPORTUNISTIC :
    RemoteConfigMode.REQUIRE;

export const cache =
    debug_fixed_config ? null :
    mode === RemoteConfigMode.DISABLE ? null :
    mode === RemoteConfigMode.OPPORTUNISTIC ? await tryLoadRemoteConfig() :
    await loadRemoteConfig();
const config = debug_fixed_config ?? cache?.data ?? default_config;

if (cache && !config.require_version.includes(version)) {
    throw new Error('nxapi update required');
}

export default config;

export interface RemoteConfigCacheData {
    created_at: number;
    updated_at: number;
    etag: string | null;
    revalidated_at: number | null;
    /** Timestamp we must attempt to update the cache, but can continue to use the data if it fails */
    stale_at: number | null;
    /** Timestamp we must discard the cache require re-downloading the data */
    expires_at: number;
    url: string;
    headers: Record<string, string[]>;
    data: NxapiRemoteConfig;
}

export interface NxapiRemoteConfig {
    /**
     * Versions that may connect to Nintendo and third-party auth APIs. The nxapi version number is sent to the server
     * so specific APIs can be disabled instead of using this.
     */
    require_version: string[];

    // If null the API should not be used
    coral: CoralRemoteConfig | null;
    coral_auth: {
        splatnet2statink: {} | null;
        flapg: {} | null;
        imink: {} | null;
    };
    moon: MoonRemoteConfig | null;
}

export interface CoralRemoteConfig {
    znca_version: string; // '2.1.1'
}

export interface MoonRemoteConfig {
    znma_version: string; // '1.17.0'
    znma_build: string; // '261'
}
