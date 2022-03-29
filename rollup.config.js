import path from 'path';

import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import nodeResolve from '@rollup/plugin-node-resolve';
import nodePolyfill from 'rollup-plugin-polyfill-node';
import html from '@rollup/plugin-html';

const preload = {
    input: 'src/app/preload/index.ts',
    output: {
        file: 'dist/app/bundle/preload.cjs',
        format: 'cjs',
    },
    plugins: [
        typescript({
            noEmit: true,
            declaration: false,
        }),
        commonjs({
            // the ".ts" extension is required
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            esmExternals: true,
        }),
    ],
    external: [
        'electron',
    ],
};

const browser = {
    input: 'src/app/browser/index.ts',
    output: {
        file: 'dist/app/bundle/browser.js',
        format: 'es',
    },
    plugins: [
        html({
            title: 'nxapi',
        }),
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
};

export default [
    preload,
    browser,
];
