import { Buffer } from 'node:buffer';
import { createWriteStream, WriteStream } from 'node:fs';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { generateEncryptedLogArchive } from '../../util/support.js';

const debug = createDebug('cli:util:log-archive');

export const command = 'log-archive [output]';
export const desc = 'Create an encrypted log archive for support';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('output', {
        describe: 'Output path',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const { default: config } = await import('../../common/remote-config.js');

    if (!config.log_encryption_key) {
        throw new Error('No log encryption key in remote configuration');
    }

    const out = await createOutputStream(argv.output);

    debug('creating log archive');

    const key = Buffer.from(config.log_encryption_key, 'base64url');
    const [encrypt] = await generateEncryptedLogArchive(key);

    encrypt.pipe(out);

    encrypt.on('end', () => {
        debug('done');
    });
}

async function createOutputStream(path?: string) {
    if (!path && process.stdout.isTTY) {
        console.error('No output path set but stdout is a TTY. Run `nxapi util log-archive -` to force output to a terminal.');
        process.exit(1);
    }

    if (!path || path === '-') {
        return process.stdout;
    }

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
