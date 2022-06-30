import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as child_process from 'child_process';

import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import nodePolyfill from 'rollup-plugin-polyfill-node';
import html from '@rollup/plugin-html';
import json from '@rollup/plugin-json';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));

const git = (() => {
    try {
        fs.statSync(path.join(dir, '.git'));
    } catch (err) {
        return null;
    }

    const options = {cwd: dir};
    const revision = child_process.execSync('git rev-parse HEAD', options).toString().trim();
    const branch = child_process.execSync('git rev-parse --abbrev-ref HEAD', options).toString().trim();
    const changed_files = child_process.execSync('git diff --name-only HEAD', options).toString().trim();

    return {
        revision,
        branch: branch && branch !== 'HEAD' ? branch : null,
        changed_files: changed_files.length ? changed_files.split('\n') : [],
    };
})();;

// If CI_COMMIT_TAG is set this is a tagged version for release
export const product = 'nxapi ' + pkg.version +
    (!process.env.CI_COMMIT_TAG && git ?
        '-' + git.revision.substr(0, 7) + (git.branch ? ' (' + git.branch + ')' : '') : '');

/**
 * @type {import('@rollup/plugin-replace').RollupReplaceOptions}
 */
const replace_options = {
    include: ['src/util/product.ts'],
    values: {
        'globalThis.__NXAPI_BUNDLE_PKG__': JSON.stringify(pkg),
        'globalThis.__NXAPI_BUNDLE_GIT__': JSON.stringify(git),
        'globalThis.__NXAPI_BUNDLE_PRODUCT__': JSON.stringify(product),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
};

/**
 * @type {import('rollup').RollupOptions['watch']}
 */
const watch = {
    include: 'src/**',
};

/**
 * @type {import('rollup').RollupOptions}
 */
const cli = {
    input: 'src/cli-entry.ts',
    output: {
        file: 'dist/bundle/cli-bundle.js',
        format: 'es',
        inlineDynamicImports: true,
        sourcemap: true,
    },
    plugins: [
        replace(replace_options),
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
            // events and stream modify module.exports
            requireReturnsDefault: 'preferred',
        }),
        json(),
        nodeResolve({
            exportConditions: ['node'],
            browser: false,
            preferBuiltins: true,
        }),
    ],
    external: [
        'node-notifier',
        'frida',
    ],
    watch,
};

/**
 * @type {import('rollup').RollupOptions}
 */
const app = {
    input: 'src/app/main/app-entry.cts',
    output: {
        file: 'dist/bundle/app-main-bundle.cjs',
        format: 'cjs',
        inlineDynamicImports: true,
        sourcemap: true,
    },
    plugins: [
        replace(replace_options),
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
            // events and stream modify module.exports
            requireReturnsDefault: 'preferred',
        }),
        json(),
        nodeResolve({
            exportConditions: ['node'],
            browser: false,
            preferBuiltins: true,
        }),
    ],
    external: [
        'electron',
    ],
    watch,
};

/**
 * @type {import('rollup').RollupOptions}
 */
const app_preload = {
    input: 'src/app/preload/index.ts',
    output: {
        file: 'dist/app/bundle/preload.cjs',
        format: 'cjs',
        sourcemap: true,
    },
    plugins: [
        replace(replace_options),
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: true,
        }),
    ],
    external: [
        'electron',
    ],
    watch,
};

/**
 * @type {import('rollup').RollupOptions}
 */
const app_preload_webservice = {
    input: 'src/app/preload-webservice/index.ts',
    output: {
        file: 'dist/app/bundle/preload-webservice.cjs',
        format: 'cjs',
    },
    plugins: [
        replace(replace_options),
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: true,
        }),
    ],
    external: [
        'electron',
    ],
    watch,
};

/**
 * @type {import('rollup').RollupOptions}
 */
const app_browser = {
    input: 'src/app/browser/index.ts',
    output: {
        file: 'dist/app/bundle/browser.js',
        format: 'iife',
        sourcemap: true,
    },
    plugins: [
        html({
            title: 'nxapi',
        }),
        replace(replace_options),
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
        }),
        nodePolyfill(),
        alias({
            entries: [
                {find: 'react-native', replacement: path.resolve(__dirname, 'node_modules', 'react-native-web')},
            ],
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
        }),
    ],
    watch,
};

export default [
    cli,
    app,
    app_preload,
    app_preload_webservice,
    app_browser,
];
