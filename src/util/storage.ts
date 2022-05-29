import * as path from 'node:path';
import createDebug from 'debug';
import persist from 'node-persist';
import getPaths from 'env-paths';

const debug = createDebug('nxapi:util:storage');

export const paths = getPaths('nxapi');

export async function initStorage(dir: string) {
    const storage = persist.create({
        dir: path.join(dir, 'persist'),
        stringify: data => JSON.stringify(data, null, 4) + '\n',
    });
    await storage.init();
    return storage;
}
