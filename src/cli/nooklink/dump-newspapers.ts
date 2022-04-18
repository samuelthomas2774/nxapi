import createDebug from 'debug';
import * as fs from 'fs/promises';
import * as path from 'path';
import mkdirp from 'mkdirp';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getUserToken } from './util.js';

const debug = createDebug('cli:nooklink:dump-newspapers');

export const command = 'dump-newspapers [directory]';
export const desc = 'Download all newspaper articles';

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

    const latest = await nooklinkuser.getLatestNewspaper();
    const newspapers = await nooklinkuser.getNewspapers();

    for (const item of newspapers.newspapers) {
        const is_latest = item.findKey === latest.findKey;

        const filename = 'nooklink-newspaper-' + nooklinkuser.user_id + '-' + item.beginDate + '-' + item.findKey +
            (is_latest ? '-' + Date.now() : '') + '.json';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
            debug('Skipping newspaper %s, date %s, file already exists', item.findKey, item.beginDate);
            continue;
        } catch (err) {}

        if (!is_latest) debug('Fetching newspaper %s, date %s', item.findKey, item.beginDate);
        const newspaper = is_latest ? latest : await nooklinkuser.getNewspaper(item.findKey);

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify(newspaper, null, 4) + '\n', 'utf-8');
    }
}
