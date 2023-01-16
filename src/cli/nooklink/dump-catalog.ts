import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import createDebug from 'debug';
import mkdirp from 'mkdirp';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getUserToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:dump-catalog');

export const command = 'dump-catalog [directory]';
export const desc = 'Download player catalog data';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('directory', {
        describe: 'Directory to write record data to',
        type: 'string',
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'nooklink');

    await mkdirp(directory);

    const catalog = await nooklinkuser.getCatalog();
    const filename = 'nooklink-catalog-' + nooklinkuser.user_id + '-' + Date.now() + '.json';
    const file = path.join(directory, filename);
    
    debug('Writing %s', filename);
    await fs.writeFile(file, JSON.stringify(catalog, null, 4) + '\n', 'utf-8');
}
