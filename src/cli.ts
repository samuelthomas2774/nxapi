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

export async function main(argv = process.argv.slice(2)) {
    const yargs = createYargs(argv);

    if (!process.env.NXAPI_SKIP_UPDATE_CHECK) await checkUpdates();

    yargs.argv;
}
