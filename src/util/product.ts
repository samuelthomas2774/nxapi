import process from 'node:process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import * as util from 'node:util';
import createDebug from 'debug';

const debug = createDebug('nxapi:util:product');

//
// Embedded package/version info injected during Rollup build
//

/** @internal */
declare global {
    var __NXAPI_BUNDLE_PKG__: any | undefined;
    var __NXAPI_BUNDLE_GIT__: {
        revision: string;
        branch: string | null;
        changed_files: string[];
    } | null | undefined;
    var __NXAPI_BUNDLE_RELEASE__: string | null | undefined;
    var __NXAPI_BUNDLE_DEFAULT_REMOTE_CONFIG__: any | undefined;
}

const embedded_pkg = globalThis.__NXAPI_BUNDLE_PKG__;
const embedded_git = globalThis.__NXAPI_BUNDLE_GIT__;
const embedded_release = globalThis.__NXAPI_BUNDLE_RELEASE__;
export const embedded_default_remote_config = globalThis.__NXAPI_BUNDLE_DEFAULT_REMOTE_CONFIG__;

//
// Package/version info
//

export const dir = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const pkg = embedded_pkg ?? JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
const match = pkg.version.match(/^(\d+\.\d+\.\d+)-next\b/i);
export const version: string = match?.[1] ?? pkg.version;
export const release: string | null = embedded_release ?? pkg.__nxapi_release ?? null;

export const git = typeof embedded_git !== 'undefined' ? embedded_git : pkg.__nxapi_git ?? await (async () => {
    try {
        await fs.stat(path.join(dir, '.git'));
    } catch (err) {
        if (!release) debug('Unable to find revision');
        return null;
    }

    const child_process = await import('node:child_process');
    const execFile = util.promisify(child_process.execFile);
    const git = (...args: string[]) => execFile('git', args, {cwd: dir}).then(({stdout}) => stdout.toString().trim());

    const [revision, branch, changed_files] = await Promise.all([
        git('rev-parse', 'HEAD'),
        git('rev-parse', '--abbrev-ref', 'HEAD'),
        git('diff', '--name-only', 'HEAD'),
    ]);

    return {
        revision,
        branch: branch && branch !== 'HEAD' ? branch : null,
        changed_files: changed_files.length ? changed_files.split('\n') : [],
    };
})();

export const dev = process.env.NODE_ENV !== 'production' &&
    (!release || process.env.NODE_ENV === 'development');

export const product = 'nxapi ' + version +
    (!release && git ? '-' + git.revision.substr(0, 7) + (git.branch ? ' (' + git.branch + ')' : '') :
        !release ? '-?' : '');
