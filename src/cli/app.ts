import process from 'node:process';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';
import { dir } from '../util/product.js';

const debug = createDebug('cli:app');

export const command = 'app';
export const desc = 'Start the Electron app';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs;
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const require = createRequire(import.meta.url);
    const electron = require('electron');

    if (typeof electron !== 'string') {
        throw new Error('Already running in Electron??');
    }

    execFileSync(electron, [
        path.resolve(dir, 'dist', 'app', 'app-entry.cjs'),
    ], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NXAPI_SKIP_UPDATE_CHECK: '1',
        },
    });
}
