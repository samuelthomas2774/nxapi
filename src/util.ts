import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as yargs from 'yargs';
import createDebug from 'debug';
import persist from 'node-persist';
import getPaths from 'env-paths';
import fetch from 'node-fetch';

const debug = createDebug('nxapi:util');

export const paths = getPaths('nxapi');

//
// Package/version info
//

export const dir = path.resolve(decodeURI(import.meta.url.substr(process.platform === 'win32' ? 8 : 7)), '..', '..');
export const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
export const version = pkg.version;
export const git = (() => {
    try {
        fs.statSync(path.join(dir, '.git'));
    } catch (err) {
        return null;
    }

    const options: child_process.ExecSyncOptions = {cwd: dir};
    const revision = child_process.execSync('git rev-parse HEAD', options).toString().trim();
    const branch = child_process.execSync('git rev-parse --abbrev-ref HEAD', options).toString().trim();
    const changed_files = child_process.execSync('git diff --name-only HEAD', options).toString().trim();

    return {
        revision,
        branch: branch && branch !== 'HEAD' ? branch : null,
        changed_files: changed_files.length ? changed_files.split('\n') : [],
    };
})();
export const dev = !!git || process.env.NODE_ENV === 'development';

//
// Yargs types
//

export type YargsArguments<T extends yargs.Argv> = T extends yargs.Argv<infer R> ? R : any;
export type Argv<T = {}> = yargs.Argv<T>;
// export type ArgumentsCamelCase<T = {}> = yargstypes.ArgumentsCamelCase<T>;

/** Convert literal string types like 'foo-bar' to 'FooBar' */
type PascalCase<S extends string> = string extends S ?
    string : S extends `${infer T}-${infer U}` ?
    `${Capitalize<T>}${PascalCase<U>}` : Capitalize<S>;

/** Convert literal string types like 'foo-bar' to 'fooBar' */
type CamelCase<S extends string> = string extends S ?
    string : S extends `${infer T}-${infer U}` ?
    `${T}${PascalCase<U>}` : S;

/** Convert literal string types like 'foo-bar' to 'fooBar', allowing all `PropertyKey` types */
type CamelCaseKey<K extends PropertyKey> = K extends string ? Exclude<CamelCase<K>, ''> : K;

/** Arguments type, with camelcased keys */
export type ArgumentsCamelCase<T = {}> = { [key in keyof T as key | CamelCaseKey<key>]: T[key] } & {
    /** Non-option arguments */
    _: Array<string | number>;
    /** The script name or node command */
    $0: string;
    /** All remaining options */
    [argName: string]: unknown;
};

//
// Other
//

export async function initStorage(dir: string) {
    const storage = persist.create({
        dir: path.join(dir, 'persist'),
        stringify: data => JSON.stringify(data, null, 4) + '\n',
    });
    await storage.init();
    return storage;
}

export function getTitleIdFromEcUrl(url: string) {
    const match = url.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);
    return match?.[1] ?? null;
}

export function hrduration(duration: number, short = false) {
    const hours = Math.floor(duration / 60);
    const minutes = duration - (hours * 60);

    const hour_str = short ? 'hr' : 'hour';
    const minute_str = short ? 'min' : 'minute';

    if (hours >= 1) {
        return hours + ' ' + hour_str + (hours === 1 ? '' : 's') +
            (minutes ? ', ' + minutes + ' ' + minute_str + (minutes === 1 ? '' : 's') : '');
    } else {
        return minutes + ' ' + minute_str + (minutes === 1 ? '' : 's');
    }
}

export abstract class Loop {
    update_interval = 60;

    init(): void | Promise<LoopResult | void> {}

    abstract update(): void | Promise<LoopResult | void>;

    protected async loopRun(init = false): Promise<LoopResult> {
        try {
            const result = init ? await this.init() : await this.update();

            return result ?? (init ? LoopResult.OK_SKIP_INTERVAL : LoopResult.OK);
        } catch (err) {
            return this.handleError(err as any);
        }
    }

    async handleError(err: Error): Promise<LoopResult> {
        throw err;
    }

    private is_loop_active = 0;

    async loop(init = false) {
        try {
            this.is_loop_active++;

            const result = await this.loopRun(init);

            if (result === LoopResult.OK) {
                if (this.skip_interval_once) {
                    this.skip_interval_once = false;
                } else {
                    await new Promise(rs => setTimeout(this.timeout_resolve = rs, this.update_interval * 1000));
                }
            }
        } finally {
            this.is_loop_active--;
            this.skip_interval_once = false;
            this.timeout_resolve = null;
        }
    }

    private skip_interval_once = false;
    private timeout_resolve: ((value: void) => void) | null = null;

    skipIntervalInCurrentLoop() {
        debug('Skip update interval', this.is_loop_active);
        if (!this.is_loop_active) return;

        this.skip_interval_once = true;
        this.timeout_resolve?.call(null);
    }
}

const LoopRunOk = Symbol('LoopRunOk');
const LoopRunOkSkipInterval = Symbol('LoopRunOkSkipInterval');

export enum LoopResult {
    OK = LoopRunOk as any,
    OK_SKIP_INTERVAL = LoopRunOkSkipInterval as any,
}

//
// JSON Web Tokens
//

export interface JwtHeader {
    typ?: 'JWT';
    alg: JwtAlgorithm;
    /** Key ID */
    kid?: string;
    /** JSON Web Key Set URL */
    jku?: string;
}
export enum JwtAlgorithm {
    RS256 = 'RS256',
}

export interface JwtPayload {
    /** Audience */
    aud: string;
    /** Expiration timestamp (seconds) */
    exp: number;
    /** Issue timestamp (seconds) */
    iat: number;
    /** Issuer */
    iss: string;
    /** Token ID */
    jti: string;
    /** Subject */
    sub: string | number;
    /** Token type */
    typ: string;
}

type JwtVerifier = (data: Buffer, signature: Buffer, key: string) => boolean;

export class Jwt<T = JwtPayload, H extends JwtHeader = JwtHeader> {
    constructor(
        readonly header: H,
        readonly payload: T
    ) {}

    static decode<T = JwtPayload, H extends JwtHeader = JwtHeader>(token: string) {
        const [header_str, payload_str, signature_str] = token.split('.', 3);

        const header = JSON.parse(Buffer.from(header_str, 'base64url').toString());
        const payload = JSON.parse(Buffer.from(payload_str, 'base64url').toString());
        const signature = Buffer.from(signature_str, 'base64url');

        if ('typ' in header && header.typ !== 'JWT') {
            throw new Error('Invalid JWT');
        }

        const jwt = new this<T, H>(header, payload);
        return [jwt, signature] as const;
    }

    verify(signature: Buffer, key: string, verifier?: JwtVerifier) {
        const header_str = Buffer.from(JSON.stringify(this.header)).toString('base64url');
        const payload_str = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
        const sign_data = header_str + '.' + payload_str;

        if (!verifier) {
            if (!(this.header.alg in Jwt.verifiers) || !Jwt.verifiers[this.header.alg]) {
                throw new Error('Unknown algorithm');
            }

            verifier = Jwt.verifiers[this.header.alg];
        }

        return verifier.call(null, Buffer.from(sign_data), signature, key);
    }

    static verifiers: Record<JwtAlgorithm, JwtVerifier> = {
        [JwtAlgorithm.RS256]: (data, signature, key) => {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.end(data);
            return verify.verify(key, signature);
        },
    };
}

//
// JSON Web Key Sets
//
// Used for verifying JSON Web Tokens
//

export interface Jwks {
    keys: Jwk[];
}
export interface Jwk {
    /** Key type */
    kty: string;
    use?: JwkUse | string;
    key_ops?: JwkKeyOperation | string;
    alg?: JwtAlgorithm | string;
    /** Key ID */
    kid?: string;
    x5u?: string[];
    x5c?: string[];
    x5t?: string;
    'x5t#S256'?: string;
}
export enum JwkUse {
    SIGNATURE = 'sig',
    ENCRYPTION = 'enc',
}
export enum JwkKeyOperation {
    SIGN = 'sign',
    VERIFY = 'verify',
    ENCRYPT = 'encrypt',
    DECRYPT = 'decrypt',
    WRAP_KEY = 'wrapKey',
    UNWRAP_KEY = 'unwrapKey',
    DERIVE_KEY = 'deriveKey',
    DERIVE_BITS = 'deriveBits',
}

interface SavedJwks {
    jwks: Jwks;
    expires_at: number;
}

export async function getJwks(url: string, storage?: persist.LocalStorage) {
    const cached_keyset: SavedJwks | undefined = await storage?.getItem('Jwks.' + url);

    if (!cached_keyset || cached_keyset.expires_at <= Date.now()) {
        debug('Downloading JSON Web Key Set from %s', url);

        const response = await fetch(url);

        const jwks = await response.json() as Jwks;

        const cached_keyset: SavedJwks = {
            jwks,
            expires_at: Date.now() + (1 * 60 * 60 * 1000), // 1 hour
        };

        await storage?.setItem('Jwks.' + url, cached_keyset);

        return jwks;
    }

    return cached_keyset.jwks;
}
