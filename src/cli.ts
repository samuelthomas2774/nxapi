import * as path from 'path';
import createDebug from 'debug';
import Yargs from 'yargs';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { paths, YargsArguments } from './util.js';
import * as commands from './cli/index.js';

const debug = createDebug('cli');

dotenvExpand.expand(dotenv.config({
    path: path.join(paths.data, '.env'),
}));
if (process.env.NXAPI_DATA_PATH) dotenvExpand.expand(dotenv.config({
    path: path.join(process.env.NXAPI_DATA_PATH, '.env'),
}));

if (process.env.DEBUG) createDebug.enable(process.env.DEBUG);

const yargs = Yargs(process.argv.slice(2)).option('data-path', {
    describe: 'Data storage path',
    type: 'string',
    default: process.env.NXAPI_DATA_PATH || paths.data,
});

export type Arguments = YargsArguments<typeof yargs>;

for (const command of Object.values(commands)) {
    // @ts-expect-error
    yargs.command(command);
}

yargs
    .scriptName('nxapi')
    .demandCommand()
    .help()
    // .version(false)
    .showHelpOnFail(false, 'Specify --help for available options');

export default yargs;
