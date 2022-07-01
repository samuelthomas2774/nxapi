import process from 'node:process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as child_process from 'node:child_process';
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
}

const embedded_pkg = globalThis.__NXAPI_BUNDLE_PKG__;
const embedded_git = globalThis.__NXAPI_BUNDLE_GIT__;
const embedded_release = globalThis.__NXAPI_BUNDLE_RELEASE__;

//
// Package/version info
//

export const dir = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const pkg = embedded_pkg ?? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
export const version: string = pkg.version;
export const release: string | null = embedded_release ?? pkg.__nxapi_release ?? null;

export const git = typeof embedded_git !== 'undefined' ? embedded_git : (() => {
    try {
        fs.statSync(path.join(dir, '.git'));
    } catch (err) {
        return null;
    }

    const options: child_process.ExecSyncOptions = {cwd: dir};
    const revision = child_process.execSync('git rev-parse HEAD', options).toString().trim();
    const branch = child_process.execSync('git rev-parse --abbrev-ref HEAD', options).toString().trim();
    const changed_files = child_process.execSync('git diff --name-only HEAD', options).toString().trim();

    return {
        revision,
        branch: branch && branch !== 'HEAD' ? branch : null,
        changed_files: changed_files.length ? changed_files.split('\n') : [],
    };
})();

export const dev = process.env.NODE_ENV !== 'production' &&
    (!!git || process.env.NODE_ENV === 'development');

export const product = 'nxapi ' + version +
    (!release && git ? '-' + git.revision.substr(0, 7) + (git.branch ? ' (' + git.branch + ')' : '') : '');
