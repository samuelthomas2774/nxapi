import * as path from 'node:path';
import * as fs from 'node:fs/promises';
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

export async function* iterateLocalStorage(storage: persist.LocalStorage) {
    const dir = (storage as unknown as {options: persist.InitOptions}).options.dir!;

    for await (const file of await fs.opendir(dir)) {
        if (!file.isFile()) continue;

        const datum = await storage.readFile(path.join(dir, file.name)) as persist.Datum;
        if (!datum || !datum.key) continue;

        yield datum;
    }
}
