import { Buffer } from 'node:buffer';
import { DecryptStream } from '@samuelthomas2774/saltpack';
import tweetnacl from 'tweetnacl';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';

const debug = createDebug('cli:util:decrypt-log-archive');

export const command = 'decrypt-log-archive';
export const desc = null;

export function builder(yargs: Argv<ParentArguments>) {
    return yargs;
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!process.env.NXAPI_SUPPORT_SECRET_KEY) {
        throw new Error('Missing NXAPI_SUPPORT_SECRET_KEY environment variable');
    }

    const key = Buffer.from(process.env.NXAPI_SUPPORT_SECRET_KEY, 'base64url');
    const keypair = tweetnacl.box.keyPair.fromSecretKey(key);

    const decrypt = new DecryptStream(keypair);

    decrypt.pipe(process.stdout);

    debug('decrypting tar.gz to stdout');

    process.stdin.pipe(decrypt);
}
