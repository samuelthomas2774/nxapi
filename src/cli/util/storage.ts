import * as util from 'node:util';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../util.js';
import { Argv } from '../../util/yargs.js';
import { initStorage, iterateLocalStorage } from '../../util/storage.js';
import Table from './table.js';
import { createHash } from 'node:crypto';

const debug = createDebug('cli:util:storage');

export const command = 'storage';
export const desc = 'Manage node-persist data';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.demandCommand().command('list', 'List all object', yargs => {}, async argv => {
        const storage = await initStorage(argv.dataPath);

        const table = new Table({
            head: [
                'File',
                'Key',
                'Value',
            ],
            colWidths: [10, 42, 80],
        });
    
        for await (const data of iterateLocalStorage(storage)) {
            const value = util.inspect(data.value, {
                compact: true,
            });

            table.push([
                createHash('md5').update(data.key).digest('hex'),
                data.key.length > 40 ? data.key.substr(0, 37) + '...' : data.key,
                value.length > 200 ? value.substr(0, 197) + '...' : value,
            ]);
        }

        table.sort((a, b) => a[1] > b[1] ? 1 : b[1] > a[1] ? -1 : 0);

        console.log(table.toString());
    });
}
