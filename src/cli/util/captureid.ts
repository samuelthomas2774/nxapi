import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../util.js';
import { Argv } from '../../util/yargs.js';

const debug = createDebug('cli:util:captureid');

export const command = 'captureid';
export const desc = 'Encrypt/decrypt capture IDs';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.demandCommand().command('encrypt <titleid>', 'Title ID to Capture ID', yargs => {
        return yargs.positional('titleid', {
            describe: 'Title ID',
            type: 'string',
            demandOption: true,
        });
    }, argv => {
        console.log(encrypt(argv.titleid));
    }).command('decrypt <captureid>', 'Capture ID to Title ID', yargs => {
        return yargs.positional('captureid', {
            describe: 'Capture ID',
            type: 'string',
            demandOption: true,
        });
    }, argv => {
        console.log(decrypt(argv.captureid));
    });
}

const key = Buffer.from('b7ed7a66c80b4b008baf7f0589c08224', 'hex');

/**
 * @param {string} tid Hex-encoded 8-byte title ID
 * @return {string} Hex-encoded 16-byte capture ID
 */
export function encrypt(tid: string) {
    if (typeof tid !== 'string' || !tid.match(/^[0-9A-Fa-f]{16}$/)) {
        throw new Error('tid must be a valid title ID');
    }

    const tidb = Buffer.from('0000000000000000' + tid, 'hex').reverse();

    const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
    cipher.setAutoPadding(false);

    const cidb = Buffer.concat([
        cipher.update(tidb),
        cipher.final(),
    ]);

    const cid = cidb.toString('hex').toUpperCase();

    return cid;
}

/**
 * @param {string} cid Hex-encoded 16-byte capture ID
 * @return {string} Hex-encoded 8-byte title ID
 */
export function decrypt(cid: string) {
    if (typeof cid !== 'string' || !cid.match(/^[0-9A-Fa-f]{32}$/)) {
        throw new Error('cid must be a valid capture ID');
    }

    const cidb = Buffer.from(cid, 'hex');

    const cipher = crypto.createDecipheriv('aes-128-ecb', key, null);
    cipher.setAutoPadding(false);

    const tidb = Buffer.concat([
        cipher.update(cidb),
        cipher.final(),
    ]).reverse();

    if (!Buffer.alloc(8).equals(tidb.slice(0, 8))) {
        throw new Error('Invalid title ID');
    }

    const tid = tidb.slice(8, 16).toString('hex');

    return tid;
}
