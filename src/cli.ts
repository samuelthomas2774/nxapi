import * as path from 'path';
import createDebug from 'debug';
import Yargs from 'yargs';
import { YargsArguments } from './util.js';
import * as commands from './cli/index.js';

const debug = createDebug('cli');

const yargs = Yargs(process.argv.slice(2)).option('data-path', {
    describe: 'Data storage path',
    type: 'string',
    default: path.join(import.meta.url.substr(7), '..', '..', 'data'),
}).option('znc-proxy-url', {
    describe: 'URL of Nintendo Switch Online app API proxy server to use',
    type: 'string',
});

export type Arguments = YargsArguments<typeof yargs>;

for (const command of Object.values(commands)) {
    // @ts-expect-error
    yargs.command(command);
}

yargs
    .scriptName('nintendo-znc')
    .demandCommand()
    .help()
    // .version(false)
    .showHelpOnFail(false, 'Specify --help for available options');

export default yargs;
