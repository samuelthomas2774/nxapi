import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetch } from 'undici';
import { ErrorResponse, ResponseSymbol } from '../api/util.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';
import { paths } from '../util/storage.js';
import { dev, dir, embedded_default_remote_config, git, version } from '../util/product.js';
import { CONFIG_URL } from './constants.js';

const debug = createDebug('nxapi:remote-config');

/** Maximum time in seconds to consider cached data fresh */
const MAX_FRESH = 24 * 60 * 60; // 1 day in seconds
/** Maximum time in seconds to allow using cached data after it's considered stale */
const MAX_STALE = 24 * 60 * 60; // 1 day in seconds

const SourceSymbol = Symbol('Source');
const CachedSymbol = Symbol('Cached');

const default_config: NxapiRemoteConfig = {
    require_version: [version],
    ...(embedded_default_remote_config ??
        JSON.parse(await fs.readFile(path.join(dir, 'resources', 'common', 'remote-config.json'), 'utf-8'))),
    [SourceSymbol]: new URL(path.join(dir, 'resources', 'common', 'remote-config.json'), 'file:///').toString(),
};

async function loadRemoteConfig() {
    await fs.mkdir(paths.cache, {recursive: true});
    const config_cache_path = path.resolve(paths.cache, 'config.json');

    const url = process.env.NXAPI_CONFIG_URL ?? CONFIG_URL;
    const url_parsed = new URL(url);

    if (url_parsed.protocol === 'file:') {
        const file = fileURLToPath(url_parsed);

        const stats = await fs.stat(file);

        const config: NxapiRemoteConfig = {
            ...JSON.parse(await fs.readFile(file, 'utf-8')),
            [SourceSymbol]: url_parsed.toString(),
        };

        const cache: RemoteConfigCacheData = {
            created_at: stats.ctimeMs,
            updated_at: stats.mtimeMs,
            etag: null,
            revalidated_at: Date.now(),
            stale_at: null,
            expires_at: Date.now(),
            version,
            revision: git?.revision ?? null,
            url: url_parsed.toString(),
            headers: {},
            data: config,
        };

        return cache;
    }

    let data: RemoteConfigCacheData | undefined = undefined;
    let must_revalidate = true;

    try {
        data = JSON.parse(await fs.readFile(config_cache_path, 'utf-8'));

        if (data) {
            Object.defineProperty(data.data, SourceSymbol, {
                enumerable: true,
                value: data.url,
            });
        }

        if (data?.version !== version || data.revision !== (git?.revision ?? null)) {
            debug('Cached remote config is for a different nxapi revision');
            throw new Error('Cached remote configuration is for a different nxapi version');
        }

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
        debug('Getting remote config from %s, must revalidate: %s', url, must_revalidate);

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
            version,
            revision: git?.revision ?? null,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries()),
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

async function getRemoteConfig(url: string, useragent?: string, cache?: {
    previous: NxapiRemoteConfig;
    updated_at: Date;
    etag: string | null;
}) {
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
            [SourceSymbol]: url,
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
        [SourceSymbol]: url,
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
    await fs.readFile(path.join(paths.data, 'remote-config.json'), 'utf-8').then(JSON.parse).then(data => {
        return Object.assign(data, {
            [SourceSymbol]: new URL(path.join(paths.data, 'remote-config.json'), 'file:///').toString(),
        });
    }).catch(err => {
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
    process.env.NXAPI_ENABLE_REMOTE_CONFIG === '0' ? RemoteConfigMode.DISABLE :
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

debug('using config', RemoteConfigMode[mode], config);

export interface RemoteConfigCacheData {
    created_at: number;
    updated_at: number;
    etag: string | null;
    revalidated_at: number | null;
    /** Timestamp we must attempt to update the cache, but can continue to use the data if it fails */
    stale_at: number | null;
    /** Timestamp we must discard the cache require re-downloading the data */
    expires_at: number;
    version: string;
    revision: string | null;
    url: string;
    headers: Record<string, string> | Record<string, string[]>;
    data: NxapiRemoteConfig;
}

export interface NxapiRemoteConfig {
    /**
     * Versions that may connect to Nintendo and third-party auth APIs. The nxapi version number is sent to the server
     * so specific APIs can be disabled instead of using this.
     */
    require_version: string[];

    log_encryption_key?: string;

    // If null the API should not be used
    coral: CoralRemoteConfig | null;
    coral_auth: {
        default: DefaultZncaApiProvider;
        splatnet2statink: {} | null;
        flapg: {} | null;
        imink: {} | null;
    };
    moon: MoonRemoteConfig | null;

    coral_gws_nooklink: NooklinkRemoteConfig | null;
    coral_gws_splatnet3: SplatNet3RemoteConfig | null;
}

export type DefaultZncaApiProvider =
    'flapg' |
    'imink' |
    ['nxapi', string];

export interface CoralRemoteConfig {
    znca_version: string;
}

export interface MoonRemoteConfig {
    znma_version: string;
    znma_build: string;
}

export interface NooklinkRemoteConfig {
    blanco_version: string;
}

export interface SplatNet3RemoteConfig {
    app_ver: string;
    version: string;
    revision: string;
    map_queries?: Partial<Record<string, [/** new query ID */ string, /** unsafe */ boolean] | null>>;
}
