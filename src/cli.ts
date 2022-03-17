import createDebug from 'debug';
import Yargs from 'yargs';
import { paths, YargsArguments } from './util.js';
import * as commands from './cli/index.js';

const debug = createDebug('cli');

const yargs = Yargs(process.argv.slice(2)).option('data-path', {
    describe: 'Data storage path',
    type: 'string',
    default: paths.data,
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
