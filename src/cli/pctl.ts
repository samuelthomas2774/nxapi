import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../cli.js';
import { Argv } from '../util.js';
import * as commands from './pctl/index.js';

const debug = createDebug('cli:pctl');

export const command = 'pctl <command>';
export const desc = 'Nintendo Switch Parental Controls';

export function builder(yargs: Argv<ParentArguments>) {
    for (const command of Object.values(commands)) {
        // @ts-expect-error
        yargs.command(command);
    }
}
