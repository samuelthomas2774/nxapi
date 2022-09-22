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
const default_remote_config =
    JSON.parse(fs.readFileSync(path.join(dir, 'resources', 'common', 'remote-config.json'), 'utf-8'));

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
const release = process.env.NODE_ENV === 'production' ? process.env.CI_COMMIT_TAG || null : null;

/**
 * @type {import('@rollup/plugin-replace').RollupReplaceOptions}
 */
const replace_options = {
    include: ['src/util/product.ts'],
    values: {
        'globalThis.__NXAPI_BUNDLE_PKG__': JSON.stringify(pkg),
        'globalThis.__NXAPI_BUNDLE_GIT__': JSON.stringify(git),
        'globalThis.__NXAPI_BUNDLE_RELEASE__': JSON.stringify(release),
        'globalThis.__NXAPI_BUNDLE_DEFAULT_REMOTE_CONFIG__': JSON.stringify(default_remote_config),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
    preventAssignment: true,
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
const main = {
    input: ['src/cli-entry.ts', 'src/app/main/index.ts'],
    output: {
        dir: 'dist/bundle',
        format: 'es',
        sourcemap: true,
        entryFileNames: chunk => {
            if (chunk.name === 'cli-entry') return 'cli-bundle.js';
            if (chunk.name === 'index') return 'app-main-bundle.js';
            return 'entry-' + chunk.name + '.js';
        },
        chunkFileNames: 'chunk-[name].js',
    },
    plugins: [
        replace(replace_options),
        typescript({
            outDir: 'dist/bundle/ts',
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
        'register-scheme',
        'bindings',
    ],
    watch,
};

/**
 * @type {import('rollup').RollupOptions}
 */
const app_entry = {
    input: 'src/app/app-entry.cts',
    output: {
        file: 'dist/bundle/app-entry.cjs',
        format: 'iife',
        inlineDynamicImports: true,
        sourcemap: true,
    },
    plugins: [
        replace(replace_options),
        replace({
            include: ['src/app/app-entry.cts'],
            values: {
                '__NXAPI_BUNDLE_APP_MAIN__': JSON.stringify('./app-main-bundle.js'),
            },
            preventAssignment: true,
        }),
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
        path.resolve(__dirname, 'src/app/app-main-bundle.js'),
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
            module: 'es2022',
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
    main,
    app_entry,
    app_preload,
    app_preload_webservice,
    app_browser,
];
