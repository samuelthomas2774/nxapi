import type { Arguments as ParentArguments } from '../../cli.js';
import createDebug from '../../util/debug.js';
import { Argv, YargsArguments } from '../../util/yargs.js';
import * as commands from './commands.js';

const debug = createDebug('cli:pctl');

export const command = 'pctl <command>';
export const desc = 'Nintendo Switch Parental Controls';

export function builder(yargs: Argv<ParentArguments>) {
    for (const command of Object.values(commands)) {
        // @ts-expect-error
        yargs.command(command);
    }

    return yargs;
}

export type Arguments = YargsArguments<ReturnType<typeof builder>>;
