import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers';
import { fetch } from 'undici';
import createDebug from '../util/debug.js';
import { git, version } from '../util/product.js';
import { paths } from '../util/storage.js';
import { timeoutSignal } from '../util/misc.js';
import { ErrorResponse, ResponseSymbol } from '../api/util.js';
import { getUserAgent } from '../util/useragent.js';

const debug = createDebug('nxapi:status');

/** Maximum time in seconds to consider cached data fresh */
const MAX_FRESH = 24 * 60 * 60; // 1 day in seconds
/** Maximum time in seconds to allow using cached data after it's considered stale */
const MAX_STALE = 24 * 60 * 60; // 1 day in seconds

export const SourceSymbol = Symbol('Source');
const CachedSymbol = Symbol('Cached');
const FailedSymbol = Symbol('Failed');
export const StatusUpdateIdentifierSymbol = Symbol('StatusUpdateIdentifier');

export interface StatusUpdateResult extends Array<StatusUpdate & {
    [StatusUpdateIdentifierSymbol]: string;
    [SourceSymbol]: string;
}> {
    [SourceSymbol]: UpdateCacheData[];
    [FailedSymbol]: UpdateCacheDataFailed[];
}

export interface StatusUpdateSubscriber {
    onUpdate(data: StatusUpdateResult): void;
    onInitialUpdate?(data: StatusUpdateResult): void;
    onNewStatusUpdate?(data: StatusUpdateResult[0]): void;
    onRemovedStatusUpdate?(data: StatusUpdateResult[0]): void;
    onUpdatedStatusUpdate?(data: StatusUpdateResult[0], previous: StatusUpdateResult[0]): void;
    onError?(err: unknown): void;
}

interface StatusUpdateSourceHandle {
    cancel(): void;
}

export class StatusUpdateMonitor {
    subscribers: StatusUpdateSubscriber[] = [];
    sources: [url: string, handle: StatusUpdateSourceHandle][] = [];
    interval_ms = 10 * 60 * 1000; // 10 minutes

    cache: StatusUpdateResult | null = null;

    addSource(url: string) {
        const handle: StatusUpdateSourceHandle = {
            cancel: () => this.removeSource(handle),
        };

        this.sources.push([url, handle]);
        if (this._timeout) this.forceUpdate();
    }

    removeSource(handle: StatusUpdateSourceHandle) {
        let index;
        let removed = 0;

        while ((index = this.sources.findIndex(s => s[1] === handle)) >= 0) {
            this.sources.splice(index, 1);
            removed++;
        }

        return !!removed;
    }

    private _timeout: NodeJS.Timeout | null = null;
    private _timeout_at: number | null = null;

    start(now = true) {
        if (this._timeout) return;
        
        if (now) {
            this._timeout = setTimeout(() => {}, 0);
            this._checkStatusUpdatesInterval();
        } else {
            this._timeout = setTimeout(() => this._checkStatusUpdatesInterval(), this.interval_ms);
            this._timeout_at = Date.now();
        }
    }

    stop() {
        if (!this._timeout) return false;

        clearTimeout(this._timeout);
        this._timeout = null;
        this._timeout_at = null;
    }

    forceUpdate() {
        if (this._timeout && !this._timeout_at) return;

        clearTimeout(this._timeout!);
        this._checkStatusUpdatesInterval();
    }

    subscribe(subscriber: StatusUpdateSubscriber, start = true) {
        if (this.subscribers.includes(subscriber)) return;
        this.subscribers.push(subscriber);
        if (start) this.start();
    }

    unsubscribe(subscriber: StatusUpdateSubscriber, stop = true) {
        let index;
        let removed = 0;

        while ((index = this.subscribers.indexOf(subscriber)) >= 0) {
            this.subscribers.splice(index, 1);
            removed++;
        }
        
        if (!removed) {
            debug('attempted to unsubscribe but already not subscribed');
            return;
        }

        if (stop && !this.subscribers.length) {
            this.stop();
        }
    }

    private async _checkStatusUpdatesInterval() {
        this._timeout_at = null;

        try {
            const result = await this.checkStatusUpdates();

            if (this.cache) {
                const added = result.filter(s => !this.cache!.find(a =>
                    s[StatusUpdateIdentifierSymbol] === a[StatusUpdateIdentifierSymbol]));
                const removed = this.cache.filter(s => !result.find(a =>
                    s[StatusUpdateIdentifierSymbol] === a[StatusUpdateIdentifierSymbol]));

                const updated = result.map(s => {
                    const existing = this.cache!.find(a =>
                        s[StatusUpdateIdentifierSymbol] === a[StatusUpdateIdentifierSymbol]);
                    
                    return existing && JSON.stringify(s) === JSON.stringify(existing) ?
                        [s, existing] as const : null as never;
                }).filter(s => s);

                if (updated.length) {
                    const subscribers = this.subscribers.filter(s => s.onUpdatedStatusUpdate);
                    debug('notifying %d subscribers of updated status updates', subscribers.length);

                    for (const [status_update, previous] of updated) {
                        for (const subscriber of subscribers) {
                            Promise.resolve()
                                .then(() => subscriber.onUpdatedStatusUpdate!.call(subscriber, status_update, previous))
                                .catch(err => debug('error notifying subscriber', err, subscriber));
                        }
                    }
                }

                if (added.length) {
                    const subscribers = this.subscribers.filter(s => s.onNewStatusUpdate);
                    debug('notifying %d subscribers of new status updates', subscribers.length);

                    for (const status_update of added) {
                        for (const subscriber of subscribers) {
                            Promise.resolve()
                                .then(() => subscriber.onNewStatusUpdate!.call(subscriber, status_update))
                                .catch(err => debug('error notifying subscriber', err, subscriber));
                        }
                    }
                }

                if (removed.length) {
                    const subscribers = this.subscribers.filter(s => s.onRemovedStatusUpdate);
                    debug('notifying %d subscribers of removed status updates', subscribers.length);

                    for (const status_update of removed) {
                        for (const subscriber of subscribers) {
                            Promise.resolve()
                                .then(() => subscriber.onRemovedStatusUpdate!.call(subscriber, status_update))
                                .catch(err => debug('error notifying subscriber', err, subscriber));
                        }
                    }
                }
            } else {
                const subscribers = this.subscribers.filter(s => s.onInitialUpdate);
                debug('notifying %d subscribers of new status updates', subscribers.length);

                for (const subscriber of subscribers) {
                    Promise.resolve()
                        .then(() => subscriber.onInitialUpdate!.call(subscriber, result))
                        .catch(err => debug('error notifying subscriber', err, subscriber));
                }
            }

            const subscribers = [...this.subscribers];
            debug('notifying %d subscribers of result', subscribers.length);
            
            for (const subscriber of subscribers) {
                Promise.resolve()
                    .then(() => subscriber.onUpdate.call(subscriber, result))
                    .catch(err => debug('error notifying subscriber', err, subscriber));
            }

            this.cache = result;
        } catch (err) {
            debug('error checking status updates', err);

            const subscribers = this.subscribers.filter(s => s.onError);
            debug('notifying %d subscribers of error result', subscribers.length);

            for (const subscriber of subscribers) {
                Promise.resolve()
                    .then(() => subscriber.onError!.call(subscriber, err))
                    .catch(err => debug('error notifying subscriber', err, subscriber));
            }
        } finally {
            if (!this._timeout || this._timeout_at) return;

            this._timeout = setTimeout(() => this._checkStatusUpdatesInterval(), this.interval_ms);
            this._timeout_at = Date.now();
        }
    }

    async checkStatusUpdates() {
        const source_urls = this.getSourceUrls();

        debug('checking status updates', source_urls.map(u => {
            const url = new URL(u[0]);
            url.hash = '#' + u[1];
            return url;
        }));

        const results = await Promise.all(source_urls.map(async ([url, params]) => {
            const data = await this.fetchStatusUpdateSource(url.href);

            return [data, url, params] as const;
        }));

        const status_updates: StatusUpdateResult = Object.assign([], {
            [SourceSymbol]: results.map(r => r[0]),
            [FailedSymbol]: [],
        });

        const ids = new Set<string>();

        for (const [data, url, params] of results) {
            if (!('data' in data)) {
                status_updates[FailedSymbol].push(data);
                continue;
            }

            for (const status_update of data.data.status_updates) {
                const id = data.url + '#' + encodeURIComponent(status_update.id);

                if (ids.has(id)) {
                    debug('duplicate status update %s from %s', status_update.id, data.url);
                    continue;
                }

                ids.add(id);

                if (status_update.tags.length && // params.has('tag') &&
                    !params.getAll('tag').find(t => status_update.tags.includes(t))
                ) continue;

                status_updates.push(Object.assign(status_update, {
                    [StatusUpdateIdentifierSymbol]: id,
                    [SourceSymbol]: data.url,
                }));
            }
        }

        return status_updates;
    }

    getSourceUrls() {
        const source_urls: [url: URL, params: URLSearchParams][] = [];

        for (const [url_str, handle] of this.sources) {
            const url = new URL(url_str);
            const hash = url.hash.substring(1);
            url.hash = '';

            const params = new URLSearchParams(hash);

            const existing = source_urls.find(u => u[0].href === url.href);

            if (existing) {
                for (const [key, value] of params) {
                    existing[1].append(key, value);
                }
            } else {
                source_urls.push([url, params]);
            }
        }

        return source_urls;
    }

    async fetchStatusUpdateSource(url: string) {
        await fs.mkdir(paths.cache, {recursive: true});
        const cache_key = createHash('sha256').update(url).digest('base64url');
        const update_cache_path = path.resolve(paths.cache, 'status-' + cache_key + '.json');

        const url_parsed = new URL(url);

        if (url_parsed.protocol === 'file:') {
            const file = fileURLToPath(url_parsed);

            const stats = await fs.stat(file);

            const config: StatusUpdateSourceResult = {
                ...JSON.parse(await fs.readFile(file, 'utf-8')),
                [SourceSymbol]: url_parsed.toString(),
            };

            const cache: UpdateCacheDataSuccess = {
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

        let data: UpdateCacheData | undefined = undefined;
        let must_revalidate = true;

        try {
            data = JSON.parse(await fs.readFile(update_cache_path, 'utf-8'));

            if (data && 'data' in data) {
                Object.defineProperty(data.data, SourceSymbol, {
                    enumerable: true,
                    value: data.url,
                });
            }

            if (data?.version !== version || data.revision !== (git?.revision ?? null)) {
                debug('Cached status update data is for a different nxapi revision');
                data = undefined;
            }

            if (data && 'data' in data && (data.stale_at ?? data.expires_at) > Date.now()) {
                // Response is still fresh
                return data;
            }

            if (data && data.expires_at > Date.now()) {
                // Response is stale, but not expired
                must_revalidate = false;
            }
        } catch (err) {}

        try {
            debug('Getting status updates from %s, must revalidate: %s', url, must_revalidate);

            const config = await this.fetchStatusUpdateSourceHttp(url, undefined, data && 'data' in data ? {
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

            const new_cache: UpdateCacheDataSuccess = {
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

            await fs.writeFile(update_cache_path, JSON.stringify(new_cache, null, 4) + '\n', 'utf-8');
            return new_cache;
        } catch (err) {
            // Throw if the data was never loaded or has expired
            if (data && 'data' in data && !must_revalidate) throw err;

            const new_cache: UpdateCacheDataFailed = {
                created_at: Date.now(),
                expires_at: Date.now() + 1800000, // 30 minutes
                version,
                revision: git?.revision ?? null,
                error_message: (err as Error).message,
            };

            await fs.writeFile(update_cache_path, JSON.stringify(new_cache, null, 4) + '\n');

            return new_cache;
        }
    }

    async fetchStatusUpdateSourceHttp(url: string, useragent?: string, cache?: {
        previous: StatusUpdateSourceResult;
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

        const data = await response.json() as StatusUpdateSourceResult;

        return Object.assign(data, {
            [SourceSymbol]: url,
            [ResponseSymbol]: response,
            [CachedSymbol]: false,
        });
    }
}

export type UpdateCacheData = UpdateCacheDataSuccess | UpdateCacheDataFailed;

export interface UpdateCacheDataSuccess {
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
    headers: Record<string, string | string[]>;
    data: StatusUpdateSourceResult;
}

export interface UpdateCacheDataFailed {
    created_at: number;
    expires_at: number;
    version: string;
    revision: string | null;
    error_message: string;
}

interface StatusUpdateSourceResult {
    status_updates: StatusUpdate[];
}

export interface StatusUpdate {
    id: string;
    title: string;
    content: string;
    action: {
        label: string;
        url: string;
    } | null;
    colour: string | null;
    notify: StatusUpdateNotify;
    notification_content: string | null;
    tags: string[];
    flags: number;
}

export enum StatusUpdateNotify {
    NO = 0,
    SILENT = 1,
    NOTIFY = 2,
}

export enum StatusUpdateFlag {
    HIDDEN = 0,
    SUPPRESS_UPDATE_BANNER = 1,
}
