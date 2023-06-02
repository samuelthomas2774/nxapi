import * as util from 'node:util';
import type { Arguments as ParentArguments } from '../util.js';
import createDebug from '../../util/debug.js';
import { Argv } from '../../util/yargs.js';
import { initStorage, iterateLocalStorage } from '../../util/storage.js';
import Table from './table.js';
import { createHash } from 'node:crypto';
import { Storage } from '../../client/storage/index.js';
import { LocalStorageProvider } from '../../client/storage/local.js';
import { Jwt } from '../../util/jwt.js';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';
import { ZNCA_CLIENT_ID } from '../../api/coral.js';
import { ZNMA_CLIENT_ID } from '../../api/moon.js';

const debug = createDebug('cli:util:storage');

export const command = 'storage';
export const desc = 'Manage node-persist data';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.demandCommand().command('list', 'List all objects', yargs => {}, async argv => {
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
    }).command('migrate', 'Migrate to LocalStorageProvider', yargs => {}, async argv => {
        const storage = await Storage.create(LocalStorageProvider, argv.dataPath);
        const persist = await initStorage(argv.dataPath);

        for await (const data of iterateLocalStorage(persist)) {
            const json = JSON.stringify(data.value, null, 4) + '\n';

            let match;

            if (match = data.key.match(/^NintendoAccountToken\.(.*)$/)) {
                const na_id = match[1];

                await storage.provider.setSessionToken(na_id, ZNCA_CLIENT_ID, data.value);
            } else if (match = data.key.match(/^NintendoAccountToken-pctl\.(.*)$/)) {
                const na_id = match[1];

                await storage.provider.setSessionToken(na_id, ZNMA_CLIENT_ID, data.value);
            } else if (match = data.key.match(/^(NsoToken|MoonToken)\.(.*)$/)) {
                const token = match[2];
                const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

                await storage.provider.setSessionItem(jwt.payload.sub, '' + jwt.payload.jti,
                    'AuthenticationData.json', json);
            } else if (match = data.key.match(/^(IksmToken|BulletToken|NookToken|NookUsers)\.(.*)$/)) {
                const key = match[1];
                const token = match[2];
                const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

                await storage.provider.setSessionItem(jwt.payload.sub, '' + jwt.payload.jti,
                    key + '.json', json);
            } else if (match = data.key.match(/^(NookAuthToken)\.(.*)\.([^.]*)$/)) {
                const key = match[1];
                const token = match[2];
                const nooklink_user_id = match[3];
                const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

                await storage.provider.setSessionItem(jwt.payload.sub, '' + jwt.payload.jti,
                    key + '-' + nooklink_user_id + '.json', json);
            } else {
                debug('Unknown key %s', data.key.substr(0, 20) + '...');
            }
        }
    });
}
