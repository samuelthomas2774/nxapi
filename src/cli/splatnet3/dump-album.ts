import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fetch } from 'undici';
import { PhotoAlbumResult } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';
import SplatNet3Api, { RequestIdSymbol } from '../../api/splatnet3.js';
import { ResponseSymbol } from '../../api/util.js';
import { timeoutSignal } from '../../util/misc.js';

const debug = createDebug('cli:splatnet3:dump-album');

export const command = 'dump-album [directory]';
export const desc = 'Download all album photos';

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
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const directory = argv.directory ?? path.join(argv.dataPath, 'splatnet3');

    await fs.mkdir(directory, {recursive: true});

    await dumpAlbumPhotos(splatnet, directory);
}

export async function dumpAlbumPhotos(
    splatnet: SplatNet3Api, directory: string,
    refresh: PhotoAlbumResult | boolean = false
) {
    debug('Fetching photo album items');
    if (typeof refresh !== 'object') console.warn('Fetching photo album items');

    const results = refresh ?
        await splatnet.getPhotoAlbumRefetch() :
        await splatnet.getPhotoAlbum();

    if (typeof refresh !== 'object' ||
        results.data.photoAlbum.items.nodes[0]?.id !== refresh.photoAlbum.items.nodes[0]?.id
    ) {
        const filename = 'splatnet3-photoalbum-' + Date.now() + '.json';
        const file = path.join(directory, filename);

        debug('Writing %s', filename);
        await fs.writeFile(file, JSON.stringify({
            result: results.data.photoAlbum,
            query: results[RequestIdSymbol],
            app_version: splatnet.version,
            be_version: results[ResponseSymbol].headers.get('x-be-version'),
        }, null, 4) + '\n', 'utf-8');
    }

    for (const item of [...results.data.photoAlbum.items.nodes].reverse()) {
        const id_str = Buffer.from(item.id, 'base64').toString() || item.id;
        const match = id_str.match(/^PhotoAlbumItem-(\d+)$/);
        const id = match ? match[1] : id_str;

        const thumbnail_filename = 'splatnet3-photothumbnail-' + id + '.jpeg';
        const thumbnail_file = path.join(directory, thumbnail_filename);

        try {
            await fs.stat(thumbnail_file);
        } catch (err) {
            debug('Fetching photo thumbnail %s', id, item.uploadedTime);
            console.warn('Fetching photo thumbnail %s', id, item.uploadedTime);

            const [signal, cancel] = timeoutSignal();
            const response = await fetch(item.thumbnail.url, {
                headers: {
                    'User-Agent': splatnet.useragent,
                },
                signal,
            }).finally(cancel);
            const data = new Uint8Array(await response.arrayBuffer());

            debug('Writing %s', thumbnail_filename);
            await fs.writeFile(thumbnail_file, data);
        }

        const filename = 'splatnet3-photo-' + id + '.jpeg';
        const file = path.join(directory, filename);

        try {
            await fs.stat(file);
        } catch (err) {
            debug('Fetching photo %s', id, item.uploadedTime);
            console.warn('Fetching photo %s', id, item.uploadedTime);

            const [signal, cancel] = timeoutSignal();
            const response = await fetch(item.photo.url, {
                headers: {
                    'User-Agent': splatnet.useragent,
                },
                signal,
            }).finally(cancel);
            const data = new Uint8Array(await response.arrayBuffer());

            debug('Writing %s', filename);
            await fs.writeFile(file, data);
        }
    }

    return results.data;
}
