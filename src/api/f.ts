import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fetch, Headers } from 'undici';
import { defineResponse, ErrorResponse } from './util.js';
import createDebug from '../util/debug.js';
import { timeoutSignal } from '../util/misc.js';
import { getUserAgent } from '../util/useragent.js';
import { client_assertion_provider, ClientAssertionProviderInterface } from '../util/nxapi-auth.js';
import { ZNCA_VERSION } from './coral.js';
import { AccountLoginParameter, AccountTokenParameter, WebServiceTokenParameter } from './coral-types.js';

const debugFlapg = createDebug('nxapi:api:flapg');
const debugImink = createDebug('nxapi:api:imink');
const debugZncaApi = createDebug('nxapi:api:znca-api');
const debugZncaAuth = createDebug('nxapi:api:znca-auth');

export abstract class ZncaApi {
    constructor(
        public useragent?: string
    ) {}

    abstract genf(
        token: string, hash_method: HashMethod,
        user?: {na_id: string; coral_user_id?: string;},
        encrypt_request?: EncryptRequestOptions,
    ): Promise<FResult>;

    encryptRequest?(url: string, token: string | null, data: string): Promise<EncryptRequestResult>;
    decryptResponse?(data: Uint8Array): Promise<DecryptResponseResult>;

    supportsEncryption(): this is RequestEncryptionProvider {
        return !!this.encryptRequest && !!this.decryptResponse;
    }
}

export interface RequestEncryptionProvider {
    encryptRequest(url: string, token: string | null, data: string): Promise<EncryptRequestResult>;
    decryptResponse(data: Uint8Array): Promise<DecryptResponseResult>;
}
export interface EncryptRequestResult {
    data: Uint8Array;
}
export interface DecryptResponseResult {
    data: string;
}

export enum HashMethod {
    CORAL = 1,
    WEB_SERVICE = 2,
}

//
// flapg
//

export async function flapg(
    hash_method: HashMethod, token: string,
    timestamp?: string | number, request_id?: string,
    useragent?: string
) {
    const { default: { coral_auth: { flapg: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents flapg API use');

    debugFlapg('Getting f parameter', {
        hash_method, token, timestamp, request_id,
    });

    const req: FlapgApiRequest = {
        hash_method: '' + hash_method as `${HashMethod}`,
        token,
        timestamp: typeof timestamp === 'number' ? '' + timestamp : undefined,
        request_id,
    };

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://flapg.com/ika/api/login-main', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': getUserAgent(useragent),
        },
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw await ErrorResponse.fromResponse(response, '[flapg] Non-200 status code');
    }

    const data = await response.json() as FlapgApiResponse;

    debugFlapg('Got f parameter', data);

    return defineResponse(data, response);
}

/** @deprecated */
export enum FlapgIid {
    /** Nintendo Switch Online app token */
    NSO = 'nso',
    /** Web service token */
    APP = 'app',
}

export interface FlapgApiRequest {
    hash_method: '1' | '2';
    token: string;
    timestamp?: string;
    request_id?: string;
}

export type FlapgApiResponse = IminkFResponse;
export type FlapgApiError = IminkFError;

export class ZncaApiFlapg extends ZncaApi {
    async genf(token: string, hash_method: HashMethod) {
        const request_id = randomUUID();

        const result = await flapg(hash_method, token, undefined, request_id, this.useragent);

        return {
            provider: 'flapg' as const,
            hash_method, token, request_id,
            timestamp: result.timestamp,
            f: result.f,
            result,
        };
    }
}

//
// imink
//

export async function iminkf(
    hash_method: HashMethod, token: string,
    timestamp?: number, request_id?: string,
    user?: {na_id: string; coral_user_id?: string;},
    useragent?: string,
) {
    const { default: { coral_auth: { imink: config } } } = await import('../common/remote-config.js');
    if (!config) throw new Error('Remote configuration prevents imink API use');

    debugImink('Getting f parameter', {
        hash_method, token, timestamp, request_id,
    });

    const req: IminkFRequest = {
        hash_method,
        token,
        timestamp: typeof timestamp === 'number' ? '' + timestamp : undefined,
        request_id,
        ...user,
    };

    const [signal, cancel] = timeoutSignal();
    const response = await fetch('https://api.imink.app/f', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': getUserAgent(useragent),
        },
        body: JSON.stringify(req),
        signal,
    }).finally(cancel);

    if (response.status !== 200) {
        throw await ErrorResponse.fromResponse(response, '[imink] Non-200 status code');
    }

    const data = await response.json() as IminkFResponse | IminkFError;

    if ('error' in data) {
        throw new ErrorResponse('[imink] ' + data.reason, response, data);
    }

    debugImink('Got f parameter "%s"', data.f);

    return defineResponse(data, response);
}

export interface IminkFRequest {
    hash_method: 1 | 2 | '1' | '2';
    token: string;
    timestamp?: string | number;
    request_id?: string;
}
export interface IminkFResponse {
    f: string;
    timestamp: number;
    request_id: string;
}
export interface IminkFError {
    reason: string;
    error: true;
}

export class ZncaApiImink extends ZncaApi {
    async genf(token: string, hash_method: HashMethod, user?: {na_id: string; coral_user_id?: string;}) {
        const request_id = randomUUID();

        const result = await iminkf(hash_method, token, undefined, request_id, user, this.useragent);

        return {
            provider: 'imink' as const,
            hash_method, token, request_id,
            timestamp: result.timestamp,
            f: result.f,
            user,
            result,
        };
    }
}

//
// nxapi znca API server
//

export interface AndroidZncaFRequest {
    hash_method: '1' | '2';
    token: string;
    timestamp?: string | number;
    request_id?: string;
    encrypt_token_request?: EncryptRequestOptions;
}
export interface AndroidZncaFResponse {
    f: string;
    timestamp?: number;
    request_id?: string;

    encrypted_token_request?: string;

    warnings?: {error: string; error_message: string}[];
}

export interface AndroidZncaEncryptRequestRequest {
    url: string;
    token: string | null;
    data: string;
}

export interface AndroidZncaDecryptResponseRequest {
    data: string;
}

export interface AndroidZncaFError {
    error: string;
    error_message?: string;

    errors?: {error: string; error_message: string}[];
    warnings?: {error: string; error_message: string}[];
}

export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope?: string;
    refresh_token?: string;
}

interface ProtectedResourceMetadata {
    resource: string;
    authorization_servers?: string[];
    jwks_uri?: string;
    scopes_supported?: string[];
    bearer_methods_supported?: string[];
    resource_signing_alg_values_supported?: string[];
    resource_name?: string;
    resource_documentation?: string;
    resource_policy_uri?: string;
    resource_tos_uri?: string;
}

interface AuthorisationServerMetadata {
   issuer: string;
   authorization_endpoint?: string;
   token_endpoint?: string;
   jwks_uri?: string;
   registration_endpoint?: string;
   scopes_supported?: string[];
   response_types_supported: string[];
   response_modes_supported?: string[];
   grant_types_supported?: string[];
   token_endpoint_auth_methods_supported?: string[];
   token_endpoint_auth_signing_alg_values_supported?: string[];
   service_documentation?: string;
   ui_locales_supported?: string[];
   op_policy_uri?: string;
   op_tos_uri?: string;
   revocation_endpoint?: string;
   revocation_endpoint_auth_methods_supported?: string[];
   revocation_endpoint_auth_signing_alg_values_supported?: string[];
   introspection_endpoint?: string;
   introspection_endpoint_auth_methods_supported?: string[];
   introspection_endpoint_auth_signing_alg_values_supported?: string[];
   code_challenge_methods_supported?: string[];
}

export interface TokenData {
    token: string;
    expires_at: number;
    refresh_token: string | null;
    result: TokenResponse;
}
export interface ResourceData {
    token_endpoint: string;
    client_assertion_aud: string;

    resource_metadata: ProtectedResourceMetadata;
    authorisation_server_metadata: AuthorisationServerMetadata;
}

export class ZncaApiNxapi extends ZncaApi implements RequestEncryptionProvider {
    readonly url: URL;
    readonly auth: NxapiZncaAuth | null;

    headers = new Headers();

    constructor(
        url: URL | string,
        auth: NxapiZncaAuth | null,
        readonly app?: {platform?: string; version?: string;},
        useragent?: string,
    ) {
        super(useragent);

        if (typeof url === 'string') {
            url = new URL(url);

            if (!url.pathname.endsWith('/')) url.pathname += '/';
        }

        this.url = url;
        this.auth = auth;

        this.headers.set('User-Agent', getUserAgent(useragent));
    }

    static create(
        url: string,
        app?: {platform?: string; version?: string;},
        useragent?: string,
    ) {
        const auth = NxapiZncaAuth.create(url, useragent);

        return new ZncaApiNxapi(url, auth, app, useragent);
    }

    async genf(
        token: string, hash_method: HashMethod, user?: {na_id: string; coral_user_id?: string},
        encrypt_token_request?: EncryptRequestOptions,
        /** @internal */ _attempt = 0,
    ): Promise<FResult> {
        if (this.auth && !this.auth.has_valid_token) await this.auth.authenticate();

        const url = new URL('f', this.url);

        debugZncaApi('Getting f parameter', {
            url: url.href, hash_method, token, timestamp: undefined, request_id: undefined, user,
            znca_platform: this.app?.platform, znca_version: this.app?.version,
            encrypt_token_request,
        });

        const req: AndroidZncaFRequest = {
            hash_method: '' + hash_method as `${HashMethod}`,
            token,
            ...user,
            encrypt_token_request,
        };

        const headers = new Headers(this.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/json');
        if (this.app?.platform) headers.append('X-znca-Platform', this.app.platform);
        if (this.app?.version) headers.append('X-znca-Version', this.app.version);
        if (ZNCA_VERSION) headers.append('X-znca-Client-Version', ZNCA_VERSION);
        if (this.auth?.token) headers.append('Authorization', 'Bearer ' + this.auth.token.token);

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(req),
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            const err = await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');

            if (this.auth && err.data?.error === 'invalid_token' && _attempt) {
                this.auth.token = null;

                return this.genf(token, hash_method, user, encrypt_token_request, _attempt + 1);
            }

            throw err;
        }

        const data = await response.json() as AndroidZncaFResponse | AndroidZncaFError;

        if ('error' in data) {
            debugZncaApi('Error getting f parameter "%s"', data.error);
            throw new ErrorResponse<AndroidZncaFError>('[znca-api] ' + (data.error_message ?? data.error), response, data);
        }

        debugZncaApi('Got f parameter', data, response.headers);

        const result = defineResponse(data, response);

        return {
            provider: 'nxapi' as const,
            url: url.href,
            hash_method, token,
            timestamp: result.timestamp!, // will be included as not sent in request
            request_id: result.request_id!,
            f: result.f,
            user,
            result,
            encrypt_request_result: result.encrypted_token_request ? Buffer.from(result.encrypted_token_request, 'base64') : undefined,
        };
    }

    async encryptRequest(
        url: string, token: string | null, data: string,
        /** @internal */ _attempt = 0,
    ): Promise<EncryptRequestResult> {
        if (this.auth && !this.auth.has_valid_token) await this.auth.authenticate();

        debugZncaApi('encrypting request', { url, data });

        const req: AndroidZncaEncryptRequestRequest = {
            url,
            token,
            data,
        };

        const headers = new Headers(this.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/octet-stream');
        if (this.app?.platform) headers.append('X-znca-Platform', this.app.platform);
        if (this.app?.version) headers.append('X-znca-Version', this.app.version);
        if (ZNCA_VERSION) headers.append('X-znca-Client-Version', ZNCA_VERSION);
        if (this.auth?.token) headers.append('Authorization', 'Bearer ' + this.auth.token.token);

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(new URL('encrypt-request', this.url), {
            method: 'POST',
            headers,
            body: JSON.stringify(req),
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            const err = await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');

            if (this.auth && err.data?.error === 'invalid_token' && !_attempt) {
                this.auth.token = null;

                return this.encryptRequest(url, token, data, _attempt + 1);
            }

            throw err;
        }

        const encrypted_data = new Uint8Array(await response.arrayBuffer());

        const result = defineResponse(encrypted_data, response);

        return {
            data: result,
        };
    }

    async decryptResponse(
        data: Uint8Array,
        /** @internal */ _attempt = 0,
    ): Promise<DecryptResponseResult> {
        if (this.auth && !this.auth.has_valid_token) await this.auth.authenticate();

        debugZncaApi('decrypting response', data);

        const req: AndroidZncaDecryptResponseRequest = {
            data: Buffer.from(data).toString('base64'),
        };

        const headers = new Headers(this.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'text/plain');
        if (this.app?.platform) headers.append('X-znca-Platform', this.app.platform);
        if (this.app?.version) headers.append('X-znca-Version', this.app.version);
        if (ZNCA_VERSION) headers.append('X-znca-Client-Version', ZNCA_VERSION);
        if (this.auth?.token) headers.append('Authorization', 'Bearer ' + this.auth.token.token);

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(new URL('decrypt-response', this.url), {
            method: 'POST',
            headers,
            body: JSON.stringify(req),
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            const err = await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');

            if (this.auth && err.data?.error === 'invalid_token' && !_attempt) {
                this.auth.token = null;

                return this.decryptResponse(data, _attempt + 1);
            }

            throw err;
        }

        const decrypted_data = await response.text();

        return {
            data: decrypted_data,

            // @ts-expect-error
            response,
        };
    }
}

export class NxapiZncaAuth {
    client_assertion_provider: ClientAssertionProviderInterface | null = null;
    client_credentials:
        { assertion: string; assertion_type: string; } |
        { id: string; secret: string; } |
        { id: string; } |
        null = null;

    token: TokenData | null = null;
    refresh_token: string | null = null;

    protected_resource: ResourceData | null = null;

    headers = new Headers();

    constructor(
        readonly resource: string,
        useragent?: string,
    ) {
        this.headers.set('User-Agent', getUserAgent(useragent));
    }

    static create(url: string, useragent?: string) {
        const resource = new URL(url).origin;

        const auth = new NxapiZncaAuth(resource, useragent);

        if (process.env.NXAPI_ZNCA_API_CLIENT_ID && process.env.NXAPI_ZNCA_API_CLIENT_SECRET) {
            auth.client_credentials = {
                id: process.env.NXAPI_ZNCA_API_CLIENT_ID,
                secret: process.env.NXAPI_ZNCA_API_CLIENT_SECRET,
            };
        } else if (process.env.NXAPI_ZNCA_API_CLIENT_ASSERTION) {
            auth.client_credentials = {
                assertion: process.env.NXAPI_ZNCA_API_CLIENT_ASSERTION,
                assertion_type: process.env.NXAPI_ZNCA_API_CLIENT_ASSERTION_TYPE ??
                    'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            };
        } else if (process.env.NXAPI_ZNCA_API_CLIENT_ID) {
            auth.client_credentials = {
                id: process.env.NXAPI_ZNCA_API_CLIENT_ID,
            };
        } else if (client_assertion_provider) {
            auth.client_assertion_provider = client_assertion_provider;
        } else {
            debugZncaAuth('client authentication not configured');
        }

        return auth;
    }

    private _authenticate: Promise<void> | null = null;

    authenticate() {
        return this._authenticate ?? (this._authenticate = this.getAccessToken()
            .then(result => {
                this.token = {
                    token: result.access_token,
                    expires_at: Date.now() + (result.expires_in * 1000),
                    refresh_token: result.refresh_token ?? this.refresh_token ?? null,
                    result,
                };
                if (result.refresh_token) {
                    this.refresh_token = result.refresh_token;
                }
            })
            .finally(() => this._authenticate = null));
    }

    get has_valid_token() {
        return !!this.token && this.token.expires_at > Date.now();
    }

    async getAccessToken(): Promise<TokenResponse> {
        const resource = this.protected_resource ?? (this.protected_resource = await this.getProtectedResource());
        const refresh_token = this.refresh_token;

        debugZncaAuth('fetching nxapi-znca-api token');

        const headers = new Headers(this.headers);
        headers.set('Accept', 'application/json');

        const body = new URLSearchParams();

        if (refresh_token) {
            body.append('grant_type', 'refresh_token');
            body.append('refresh_token', refresh_token);
        } else {
            body.append('grant_type', 'client_credentials');
            body.append('scope', 'ca:gf ca:er ca:dr');
        }

        if (this.client_credentials && 'secret' in this.client_credentials) {
            body.append('client_id', this.client_credentials.id);
            body.append('client_secret', this.client_credentials.secret);
        } else if (this.client_credentials && 'assertion' in this.client_credentials) {
            body.append('client_assertion_type', this.client_credentials.assertion_type);
            body.append('client_assertion', this.client_credentials.assertion);
        } else if (this.client_credentials && 'id' in this.client_credentials) {
            body.append('client_id', this.client_credentials.id);
        } else if (this.client_assertion_provider) {
            const { assertion, type } = await this.client_assertion_provider.create(resource.client_assertion_aud);

            body.append('client_assertion_type', type);
            body.append('client_assertion', assertion);
        } else {
            if (resource.resource_metadata.resource_documentation) {
                throw new TypeError('Client authentication not configured\n\n' +
                    'See resource documentation at ' + resource.resource_metadata.resource_documentation);
            }

            throw new TypeError('Client authentication not configured');
        }

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(resource.token_endpoint, {
            method: 'POST',
            headers,
            body,
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            const err = await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');

            if (refresh_token && err.data?.error === 'invalid_grant') {
                this.refresh_token = null;

                return this.getAccessToken();
            }

            throw err;
        }

        const data = await response.json() as TokenResponse;

        const result = defineResponse(data, response);

        debugZncaAuth('token', result);

        return result;
    }

    async getProtectedResource() {
        const resource_metadata = await this.getProtectedResourceMetadata(this.resource);

        if (!resource_metadata.authorization_servers?.length) {
            throw new TypeError('Unable to find authorisation server');
        }
        if (resource_metadata.authorization_servers.length > 1) {
            debugZncaAuth('multiple authorisation servers returned for %s, using first', this.resource);
        }

        const authorisation_server = resource_metadata.authorization_servers[0];

        const authorisation_server_metadata = await this.getAuthorisationServerMetadata(authorisation_server);

        if (!authorisation_server_metadata.token_endpoint) {
            throw new TypeError('Unable to find authorisation server token endpoint');
        }

        return {
            token_endpoint: authorisation_server_metadata.token_endpoint,
            client_assertion_aud: authorisation_server_metadata.issuer,

            resource_metadata,
            authorisation_server_metadata,
        };
    }

    async getProtectedResourceMetadata(resource: URL | string) {
        if (typeof resource === 'string') resource = new URL(resource);

        if (resource.search) debugZncaAuth('resource identifier contains search parameters');
        if (resource.hash) throw new TypeError('Resource identifier contains fragment');

        debugZncaAuth('fetching protected resource metadata for %s', this.getIssuerFromUrl(resource));

        const metadata_url = new URL(resource);

        metadata_url.pathname = '/.well-known/oauth-protected-resource' +
            (metadata_url.pathname === '/' ? '' : metadata_url.pathname);

        const headers = new Headers(this.headers);
        headers.set('Accept', 'application/json');

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(metadata_url, {
            headers,
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            throw await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');
        }

        const data = await response.json() as ProtectedResourceMetadata;

        const result = defineResponse(data, response);

        return result;
    }

    async getAuthorisationServerMetadata(issuer: URL | string) {
        if (typeof issuer === 'string') issuer = new URL(issuer);

        if (issuer.search) debugZncaAuth('issuer identifier contains search parameters');
        if (issuer.hash) throw new TypeError('Issuer identifier contains fragment');

        debugZncaAuth('fetching authorisation server metadata for %s', this.getIssuerFromUrl(issuer));

        const metadata_url = new URL(issuer);

        metadata_url.pathname = '/.well-known/oauth-authorization-server' +
            (metadata_url.pathname === '/' ? '' : metadata_url.pathname);

        const headers = new Headers(this.headers);
        headers.set('Accept', 'application/json');

        const [signal, cancel] = timeoutSignal();
        const response = await fetch(metadata_url, {
            headers,
            signal,
        }).finally(cancel);

        if (response.status !== 200) {
            throw await ErrorResponse.fromResponse<AndroidZncaFError>(response, '[znca-api] Non-200 status code');
        }

        const data = await response.json() as AuthorisationServerMetadata;

        const result = defineResponse(data, response);

        return result;
    }

    getIssuerFromUrl(issuer: URL) {
        if (issuer.search || issuer.hash) return issuer.href;
        if (issuer.pathname !== '/') return issuer.href;
        return issuer.origin;
    }
}

export type FResult = {
    provider: string;
    hash_method: HashMethod;
    token: string;
    timestamp: number;
    request_id: string;
    f: string;
    user?: {na_id: string; coral_user_id?: string;};
    result: unknown;
    encrypt_request_result?: Uint8Array;
} & ({
    provider: 'flapg';
    result: FlapgApiResponse;
} | {
    provider: 'imink';
    result: IminkFResponse;
} | {
    provider: 'nxapi';
    url: string;
    result: AndroidZncaFResponse;
});

interface ZncaApiOptions {
    useragent?: string;
    platform?: string;
    version?: string;
    user?: {na_id: string; coral_user_id?: string;};
    encrypt_request?: EncryptRequestOptions;
}
interface EncryptRequestOptions {
    url: string;
    parameter: AccountLoginParameter | AccountTokenParameter | WebServiceTokenParameter;
}

export async function createZncaApi(options?: ZncaApiOptions) {
    return getPreferredZncaApiFromEnvironment(options) ?? await getDefaultZncaApi(options);
}

export function getPreferredZncaApiFromEnvironment(options?: ZncaApiOptions): ZncaApi | null;
export function getPreferredZncaApiFromEnvironment(useragent?: string): ZncaApi | null;
export function getPreferredZncaApiFromEnvironment(options?: ZncaApiOptions | string): ZncaApi | null {
    if (typeof options === 'string') options = {useragent: options};

    if (process.env.NXAPI_ZNCA_API) {
        if (process.env.NXAPI_ZNCA_API === 'flapg') {
            return new ZncaApiFlapg(options?.useragent);
        }
        if (process.env.NXAPI_ZNCA_API === 'imink') {
            return new ZncaApiImink(options?.useragent);
        }

        throw new Error('Unknown znca API provider');
    }

    if (process.env.ZNCA_API_URL) {
        return ZncaApiNxapi.create(process.env.ZNCA_API_URL, options, options?.useragent);
    }

    return null;
}

export async function getDefaultZncaApi(options?: ZncaApiOptions): Promise<ZncaApi>;
export async function getDefaultZncaApi(useragent?: string): Promise<ZncaApi>;
export async function getDefaultZncaApi(options?: ZncaApiOptions | string) {
    if (typeof options === 'string') options = {useragent: options};

    const { default: { coral_auth: { default: provider } } } = await import('../common/remote-config.js');

    if (provider === 'flapg') {
        return new ZncaApiFlapg(options?.useragent);
    }
    if (provider === 'imink') {
        return new ZncaApiImink(options?.useragent);
    }

    if (provider[0] === 'nxapi') {
        return ZncaApiNxapi.create(provider[1], options, options?.useragent);
    }

    throw new Error('Invalid znca API provider');
}
