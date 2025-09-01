import { createHash } from 'node:crypto';
import { Jwt, JwtAlgorithm } from './jwt.js';
import { dev, git, pkg, release } from './product.js';

export const NXAPI_AUTH_CLI_CLIENT_ID = 'CKtknJ6HiH2AZIMw-x8ljw';
export const NXAPI_AUTH_APP_CLIENT_ID = 'GlR_qsPZpNcxqMwnbsSjMA';

export let client_auth_provider: ClientAuthProviderInterface | null = null;
export let client_assertion_provider: ClientAssertionProviderInterface | null = null;

export function setClientAuthentication(provider: ClientAuthProviderInterface) {
    client_auth_provider = provider;
}
export function setClientAssertionProvider(provider: ClientAssertionProviderInterface) {
    client_assertion_provider = provider;
}

export type ClientAuthProviderInterface =
    ClientAssertionProviderInterface |
    ClientCredentialsInterface;

export interface ClientAssertionProviderInterface {
    scope: string;
    create(aud: string, exp?: number): Promise<OAuthClientAssertion>;
}
export interface OAuthClientAssertion {
    assertion: string;
    type: string;
}

export interface ClientCredentialsInterface {
    id: string;
    secret?: string;
    scope: string;
}

export class ClientAssertionProvider implements ClientAssertionProviderInterface {
    constructor(
        readonly client_id: string,
        // readonly iss = 'nxapi',
        readonly iss = client_id,
        public scope = 'ca:gf ca:er ca:dr',
    ) {}

    async create(aud: string, exp = 60) {
        const assertion = await this.createAssertion(aud, exp);
        const type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

        return { assertion, type };
    }

    async createAssertion(aud: string, exp = 60) {
        const jwt = this.createAssertionJwt(aud, exp);
        const key = await this.createAssertionKey();

        return jwt.sign(key);
    }

    createAssertionJwt(aud: string, exp = 60) {
        const now = Math.floor(Date.now() / 1000);

        const data = Buffer.alloc(22 + (release?.length ?? 0));

        if (git) Buffer.from(git.revision, 'hex').copy(data, 1, 0, 20);
        if (dev) data[21] |= 1;
        if (release) data.write(release, 22);

        return new Jwt({
            alg: JwtAlgorithm.HS256,
            typ: 'JWT',
        }, {
            typ: 'client_assertion',
            iss: this.iss,
            aud,
            exp: now + exp,
            iat: now,
            nxapi: data.toString('base64'),
        });
    }

    async createAssertionKey() {
        if (release) {
            const hash = createHash('sha256');

            const ts = Buffer.alloc(8);
            ts.writeUint32BE(Math.floor(Date.now() / 10000));
            hash.update(ts);

            hash.update(JSON.stringify(pkg), 'utf-8');

            const digest = hash.digest();

            return digest;
        }

        return Buffer.alloc(32);
    }
}
