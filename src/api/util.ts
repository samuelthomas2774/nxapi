import * as crypto from 'crypto';
import { Response } from 'node-fetch';

export class ErrorResponse<T = unknown> extends Error {
    readonly body: string | undefined;
    readonly data: T | undefined = undefined;

    constructor(
        message: string,
        readonly response: Response,
        body?: string | T
    ) {
        super(message);

        if (typeof body === 'string') {
            this.body = body;
            try {
                this.data = body ? JSON.parse(body) : undefined;
            } catch (err) {}
        } else if (typeof body !== 'undefined') {
            this.data = body;
        }
    }
}

Object.defineProperty(ErrorResponse, Symbol.hasInstance, {
    configurable: true,
    value: (instance: ErrorResponse) => {
        return instance instanceof Error &&
            'response' in instance &&
            instance.response instanceof Response &&
            'body' in instance &&
            'data' in instance;
    },
});

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
