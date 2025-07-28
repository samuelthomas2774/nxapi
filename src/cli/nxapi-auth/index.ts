import type { Arguments as ParentArguments } from '../../cli.js';
import createDebug from '../../util/debug.js';
import { Argv, YargsArguments } from '../../util/yargs.js';
import * as commands from './commands.js';

const debug = createDebug('cli:nxapi-auth');

export const command = 'nxapi-auth <command>';
export const desc = 'nxapi-auth';

export function builder(yargs: Argv<ParentArguments>) {
    for (const command of Object.values(commands)) {
        // @ts-expect-error
        yargs.command(command);
    }

    return yargs;
}

export type Arguments = YargsArguments<ReturnType<typeof builder>>;
