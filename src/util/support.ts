import { resolve } from 'node:path';
import * as os from 'node:os';
import { EncryptStream } from '@samuelthomas2774/saltpack';
import { Header, list, Pack, ReadEntry } from 'tar';
import createDebug from './debug.js';
import { dev, docker, git, paths, product, release, version } from './product.js';
import { getUserAgent } from './useragent.js';

const debug = createDebug('nxapi:util:support');

export async function createLogArchive(log_path = paths.log) {
    const tar = new Pack({
        gzip: true,
        cwd: log_path,
        preservePaths: true,
        onWriteEntry: e => {
            if (e.path === 'info.json') return;
            if (e.path.startsWith(log_path)) {
                e.path = e.path.substring(log_path.length + 1);
            }
            e.path = 'log/' + e.path;
        },
    });

    tar.on('error', err => {
        debug('archive error', err);
    });

    const data = getSystemInfo();
    tar.add(createJsonFileEntry(data, 'info.json'));

    await addFiles(tar, log_path);

    tar.end();

    return tar;
}

async function addFiles(tar: Pack, file: string) {
    if (file.charAt(0) === '@') {
        await list({
            file: resolve(tar.cwd, file.slice(1)),
            noResume: true,
            onReadEntry: entry => {
                tar.add(entry);
            },
        });
    } else {
        tar.add(file);
    }
}

function getSystemInfo() {
    return {
        version,
        created_at: new Date(),
        product: {
            release,
            docker,
            git,
            dev,
            product,
            user_agent: getUserAgent(),
        },
        environment: {
            execPath: process.execPath,
            execArgv: process.execArgv,
            argv: process.argv,
            env: process.env,
            paths,
        },
        node: {
            versions: process.versions,
            features: process.features,
        },
        system: {
            platform: process.platform,
            arch: process.arch,
            uname: os.version(),
        },
    };
}

function createJsonFileEntry(data: unknown, name: string, date = new Date()) {
    debug('adding file', name, data);

    const buffer = Buffer.from(JSON.stringify(data, null, 4) + '\n', 'utf-8');

    const header = new Header({
        path: name,
        mode: 0o600,
        uid: process.getuid?.() ?? 0,
        gid: process.getgid?.() ?? 0,
        ctime: date,
        mtime: date,
        size: buffer.length,
        type: 'File',
    });

    const entry = new ReadEntry(header);

    entry.end(buffer);

    return entry;
}

export async function generateEncryptedLogArchive(key: Uint8Array, log_path = paths.log) {
    const encrypt = new EncryptStream(null, [key]);

    encrypt.on('error', err => {
        debug('encrypt error', err);
    });

    const tar = await createLogArchive();

    tar.pipe(encrypt);

    return [encrypt, tar] as const;
}
