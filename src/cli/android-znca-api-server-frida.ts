import process from 'node:process';
import createDebug from '../util/debug.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';

const debug = createDebug('cli:android-znca-api-server-frida');

export const command = 'android-znca-api-server-frida';
export const desc = null;

export function builder(yargs: Argv<ParentArguments>) {
    return yargs;
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    console.log('This command is now part of a separate package available at https://gitlab.fancy.org.uk/samuel/nxapi-znca-api or https://github.com/samuelthomas2774/nxapi-znca-api.');
    process.exit(1);
}
