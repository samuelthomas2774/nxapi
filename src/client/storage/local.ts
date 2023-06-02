import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import mkdirp from 'mkdirp';
import createDebug from '../../util/debug.js';
import { StorageProvider } from './index.js';

const debug = createDebug('nxapi:client:storage:local');

export class LocalStorageProvider implements StorageProvider {
    protected constructor(readonly path: string) {}

    async getSessionToken(na_id: string, client_id: string) {
        await mkdirp(path.join(this.path, 'users', na_id));

        try {
            debug('read', path.join('users', na_id, 'session-' + client_id));
            const token = await fs.readFile(path.join(this.path, 'users', na_id, 'session-' + client_id), 'utf-8');

            return token;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw err;
        }
    }

    async setSessionToken(na_id: string, client_id: string, token: string) {
        await mkdirp(path.join(this.path, 'users', na_id));

        debug('write', path.join('users', na_id, 'session-' + client_id));
        await fs.writeFile(path.join(this.path, 'users', na_id, 'session-' + client_id), token, 'utf-8');
    }

    async getSessionItem(na_id: string, session_id: string, key: string) {
        await mkdirp(path.join(this.path, 'sessions', na_id, session_id));

        try {
            debug('read', path.join('sessions', na_id, session_id, key));
            return await fs.readFile(path.join(this.path, 'sessions', na_id, session_id, key), 'utf-8');
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw err;
        }
    }

    async setSessionItem(na_id: string, session_id: string, key: string, value: string) {
        await mkdirp(path.join(this.path, 'sessions', na_id, session_id));

        debug('write', path.join('sessions', na_id, session_id, key));
        await fs.writeFile(path.join(this.path, 'sessions', na_id, session_id, key), value, 'utf-8');
    }

    static async create(path: string | URL) {
        if (path instanceof URL) path = fileURLToPath(path);

        await mkdirp(path);

        return new LocalStorageProvider(path);
    }
}
