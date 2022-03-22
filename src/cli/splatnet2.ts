import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../cli.js';
import { Argv, YargsArguments } from '../util.js';
import * as commands from './splatnet2/index.js';

const debug = createDebug('cli:splatnet2');

export const command = 'splatnet2 <command>';
export const desc = 'SplatNet 2';

export function builder(yargs: Argv<ParentArguments>) {
    for (const command of Object.values(commands)) {
        // @ts-expect-error
        yargs.command(command);
    }

    return yargs.option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
    }).option('auto-update-iksm-session', {
        describe: 'Automatically obtain and refresh the iksm_session cookie',
        type: 'boolean',
        default: true,
    });
}

export type Arguments = YargsArguments<ReturnType<typeof builder>>;
