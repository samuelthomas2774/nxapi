import * as path from 'path';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import { paths, version } from '../util.js';

const debug = createDebug('cli:update');

const RELEASES_URL = 'https://api.github.com/repos/samuelthomas2774/nxapi/releases';

export async function checkUpdates() {
    const dir = path.resolve(import.meta.url.substr(7), '..', '..', '..');

    try {
        await fs.stat(path.join(dir, '.git'));

        debug('git repository exists, skipping update check');
        return null;
    } catch (err) {}

    await mkdirp(paths.cache);
    const update_cache_path = path.resolve(paths.cache, 'update.json');

    try {
        const data: UpdateCacheData = JSON.parse(await fs.readFile(update_cache_path, 'utf-8'));

        if (data && data.expires_at > Date.now()) {
            if (data.current_version !== version) return data;

            if ('update_available' in data && data.update_available) {
                console.warn('[nxapi] Update available - current version %s, latest %s',
                    data.current_version, data.latest_version);
            }

            return data;
        }
    } catch (err) {}

    debug('Checking for updates');

    try {
        const response = await fetch(RELEASES_URL);
        const releases = await response.json() as Release[];

        const current = releases.find(r => r.tag_name === 'v' + version);
        const latest = releases.find(r => !r.prerelease || current?.prerelease) ?? releases[0];
        const latest_version = latest.tag_name.replace(/^v/, '');

        const data: UpdateCacheDataSuccess = {
            created_at: Date.now(),
            expires_at: Date.now() + 86400000, // 24 hours
            releases,
            releases_url: RELEASES_URL,
            current,
            current_version: version,
            latest,
            latest_version,
            update_available: version !== latest_version,
        };

        await fs.writeFile(update_cache_path, JSON.stringify(data, null, 4) + '\n');

        if (data.update_available) {
            console.warn('[nxapi] Update available - current version %s, latest %s', version, latest_version);
        } else {
            debug('Using latest %s version %s', latest.prerelease ? 'prerelease' : 'stable', latest_version);
        }

        debug('Next update check at %s', new Date(data.expires_at));

        return data;
    } catch (err) {
        console.warn('[nxapi] Update check failed', err);

        const data: UpdateCacheDataFailed = {
            created_at: Date.now(),
            expires_at: Date.now() + 1800000, // 30 minutes
            current_version: version,
            error_message: (err as Error).message,
        };

        await fs.writeFile(update_cache_path, JSON.stringify(data, null, 4) + '\n');

        return data;
    }
}

export type UpdateCacheData = UpdateCacheDataSuccess | UpdateCacheDataFailed;

export interface UpdateCacheDataSuccess {
    created_at: number;
    expires_at: number;
    releases: Release[];
    releases_url: string;
    current: Release | undefined;
    current_version: string;
    latest: Release;
    latest_version: string;
    update_available: boolean;
}

export interface UpdateCacheDataFailed {
    created_at: number;
    expires_at: number;
    current_version: string;
    error_message: string;
}

interface Release {
    url: string;
    assets_url: string;
    upload_url: string;
    html_url: string;
    id: number;
    author: ReleaseAuthor;
    node_id: string;
    tag_name: string;
    target_commitish: string;
    name: string;
    draft: boolean;
    prerelease: boolean;
    created_at: string;
    published_at: string;
    assets: unknown[];
    tarball_url: string;
    zipball_url: string;
    body: string;
}
interface ReleaseAuthor {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: 'User';
    site_admin: boolean;
}
