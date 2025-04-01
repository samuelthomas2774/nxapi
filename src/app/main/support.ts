import { Buffer } from 'node:buffer';
import { createWriteStream, WriteStream } from 'node:fs';
import { app, dialog, Notification, shell } from 'electron';
import createDebug from '../../util/debug.js';
import { generateEncryptedLogArchive } from '../../util/support.js';
import { join } from 'node:path';
import { showErrorDialog } from './util.js';

const debug = createDebug('app:main:support');

export async function createLogArchive() {
    let start_notification: Notification | null = null;

    try {
        const { default: config } = await import('../../common/remote-config.js');

        if (!config.log_encryption_key) {
            throw new Error('No log encryption key in remote configuration');
        }

        const default_name = 'nxapi-logs-' +
            new Date().toISOString().replace(/[-:Z]/g, '').replace(/\.\d+/, '').replace(/T/, '-') +
            '.tar.gz';

        const result = await dialog.showSaveDialog({
            defaultPath: join(app.getPath('downloads'), default_name),
            filters: [{name: 'Tape archive (encrypted)', extensions: ['tgz', 'tar.gz']}],
        });

        if (result.canceled) return;

        const out = await createOutputStream(result.filePath);

        debug('creating log archive');

        start_notification = new Notification({
            title: 'Creating log archive',
        });
        start_notification.show();

        const key = Buffer.from(config.log_encryption_key, 'base64url');
        const [encrypt] = await generateEncryptedLogArchive(key);

        encrypt.pipe(out);

        await new Promise((rs, rj) => {
            encrypt.on('end', rs);
            encrypt.on('error', rj);
        });

        debug('done');

        start_notification.close();

        new Notification({
            title: 'Created log archive',
        }).show();

        shell.showItemInFolder(result.filePath);
    } catch (err) {
        start_notification?.close();

        showErrorDialog({
            message: 'Error creating log archive',
            error: err,
        });
    }
}

async function createOutputStream(path: string) {
    return new Promise<WriteStream>((rs, rj) => {
        const out = createWriteStream(path);

        const onready = () => {
            out.removeListener('ready', onready);
            out.removeListener('error', onerror);
            rs(out);
        };
        const onerror = () => {
            out.removeListener('ready', onready);
            out.removeListener('error', onerror);
            rs(out);
        };

        out.on('ready', onready);
        out.on('error', onerror);
    });
}
