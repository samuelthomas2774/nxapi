import { createHmac, createSign, createVerify, KeyLike, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import persist from 'node-persist';
import { fetch } from 'undici';
import createDebug from './debug.js';
import { timeoutSignal } from './misc.js';

const debug = createDebug('nxapi:util:jwt');

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
    HS256 = 'HS256',
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
    jti: string | number;
    /** Subject */
    sub: string | number;
    /** Token type */
    typ: string;
}

type JwtVerifier = (data: Buffer, signature: Buffer, key: KeyLike) => boolean;
type JwtSigner = (data: Buffer, key: KeyLike) => Buffer;

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

    verify(signature: Buffer, key: KeyLike, verifier?: JwtVerifier) {
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
            const verify = createVerify('RSA-SHA256');
            verify.update(data);
            return verify.verify(key, signature);
        },
        [JwtAlgorithm.HS256]: (data, signature, key) => {
            const hmac = createHmac('sha256', key);
            hmac.update(data);
            return timingSafeEqual(signature, hmac.digest());
        },
    };

    sign(key: KeyLike, signer?: JwtSigner) {
        const header_str = Buffer.from(JSON.stringify(this.header)).toString('base64url');
        const payload_str = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
        const sign_data = header_str + '.' + payload_str;

        if (!signer) {
            if (!(this.header.alg in Jwt.signers) || !Jwt.signers[this.header.alg]) {
                throw new Error('Unknown algorithm');
            }

            signer = Jwt.signers[this.header.alg];
        }

        const signature = signer.call(null, Buffer.from(sign_data), key);
        return sign_data + '.' + signature.toString('base64url');
    }

    static signers: Record<JwtAlgorithm, JwtSigner> = {
        [JwtAlgorithm.RS256]: (data, key) => {
            const sign = createSign('RSA-SHA256');
            sign.update(data);
            return sign.sign(key);
        },
        [JwtAlgorithm.HS256]: (data, key) => {
            const hmac = createHmac('sha256', key);
            hmac.update(data);
            return hmac.digest();
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

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(url, {signal}).finally(cancel);

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
