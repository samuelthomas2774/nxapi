import process from 'node:process';
import * as path from 'node:path';
import createDebug from 'debug';
import Yargs from 'yargs';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import * as commands from './cli/index.js';
import { checkUpdates } from './common/update.js';
import { dev } from './util/product.js';
import { paths } from './util/storage.js';
import { YargsArguments } from './util/yargs.js';
import { addUserAgent } from './util/useragent.js';
import { USER_AGENT_INFO_URL } from './common/constants.js';

const debug = createDebug('cli');

dotenvExpand.expand(dotenv.config({
    path: path.join(paths.data, '.env'),
}));
if (process.env.NXAPI_DATA_PATH) dotenvExpand.expand(dotenv.config({
    path: path.join(process.env.NXAPI_DATA_PATH, '.env'),
}));

if (process.env.DEBUG) createDebug.enable(process.env.DEBUG);

export function createYargs(argv: string[]) {
    const yargs = Yargs(argv).option('data-path', {
        describe: 'Data storage path',
        type: 'string',
        default: process.env.NXAPI_DATA_PATH || paths.data,
    });

    for (const command of Object.values(commands)) {
        if (command.command === 'app' && !dev) continue;

        // @ts-expect-error
        yargs.command(command);
    }

    yargs
        .scriptName('nxapi')
        .demandCommand()
        .help()
        // .version(false)
        .showHelpOnFail(false, 'Specify --help for available options');

    return yargs;
}

export type Arguments = YargsArguments<ReturnType<typeof createYargs>>;

// Node.js docs recommend using process.stdout.isTTY (see https://github.com/samuelthomas2774/nxapi/issues/15)
const is_terminal = process.stdin.isTTY && process.stderr.isTTY;

export async function main(argv = process.argv.slice(2)) {
    addUserAgent('nxapi-cli');

    if (process.env.NXAPI_USER_AGENT) {
        addUserAgent(process.env.NXAPI_USER_AGENT);
    } else if (!is_terminal) {
        console.warn('[warn] The nxapi command is not running in a terminal. If using the nxapi command in a script or other program, the NXAPI_USER_AGENT environment variable should be set. See ' + USER_AGENT_INFO_URL + '.');
        addUserAgent('unidentified-script');
    }

    const yargs = createYargs(argv);

    if (!process.env.NXAPI_SKIP_UPDATE_CHECK) await checkUpdates();

    yargs.argv;
}
