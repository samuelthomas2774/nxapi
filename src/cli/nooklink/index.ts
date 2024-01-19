import process from 'node:process';
import type { Arguments as ParentArguments } from '../../cli.js';
import createDebug from '../../util/debug.js';
import { Argv, YargsArguments } from '../../util/yargs.js';
import * as commands from './commands.js';

const debug = createDebug('cli:nooklink');

export const command = 'nooklink <command>';
export const desc = 'NookLink';

export function builder(yargs: Argv<ParentArguments>) {
    for (const command of Object.values(commands)) {
        // @ts-expect-error
        yargs.command(command);
    }

    return yargs.option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    }).option('auto-update-session', {
        describe: 'Automatically obtain and refresh the NookLink game web token and user token',
        type: 'boolean',
        default: true,
    });
}

export type Arguments = YargsArguments<ReturnType<typeof builder>>;
