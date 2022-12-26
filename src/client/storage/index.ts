import createDebug from 'debug';
import { NintendoAccountSessionTokenJwtPayload } from '../../api/na.js';
import { Jwt } from '../../util/jwt.js';
import { SavedToken as SavedNaToken } from '../na.js';

const debug = createDebug('nxapi:client:storage');

export interface StorageProvider {
    getSessionToken(na_id: string, client_id: string): Promise<string | null>;
    getSessionItem(na_id: string, session_id: string, key: string): Promise<string | null>;
    setSessionItem(na_id: string, session_id: string, key: string, value: string): Promise<void>;
}

type PromiseType<T extends Promise<any>> = T extends Promise<infer R> ? R : never;
type ConstructorType<T extends new (...args: any) => any> = T extends new (...args: any) => infer R ? R : never;

export class Storage<T extends StorageProvider = StorageProvider> {
    constructor(readonly provider: T) {}

    async getSessionToken(na_id: string, client_id: string) {
        return this.provider.getSessionToken(na_id, client_id);
    }

    async getSession<T>(na_id: string, client_id: string): Promise<NintendoAccountSession<T> | null> {
        const token = await this.provider.getSessionToken(na_id, client_id);
        if (!token) return null;

        const session = new NintendoAccountSession<T>(this, token, na_id, client_id);
        return session;
    }

    async getJsonSessionItem<T>(na_id: string, session_id: string, key: string) {
        const value = await this.provider.getSessionItem(na_id, session_id, key + '.json');
        if (!value) return null;

        const data = JSON.parse(value) as T;
        return data;
    }

    async setJsonSessionItem<T>(na_id: string, session_id: string, key: string, data: T) {
        const value = JSON.stringify(data, null, 4) + '\n';
        await this.provider.setSessionItem(na_id, session_id, key + '.json', value);
    }

    static create<
        C extends {
            create(args: any): StorageProvider | Promise<StorageProvider>;
        } | {
            new (args: any): StorageProvider;
        },
        R extends
            C extends { create(args: any): Promise<StorageProvider>; } ?
                Promise<Storage<PromiseType<ReturnType<C['create']> extends Promise<any> ? ReturnType<C['create']> : never>>> :
            C extends { create(args: any): StorageProvider; } ?
                Storage<ReturnType<C['create']> extends StorageProvider ? ReturnType<C['create']> : never> :
            C extends new (args: any) => StorageProvider ? Storage<ConstructorType<C>> :
            never,
    >(
        constructor: C,
        ...args:
            C extends { create(args: any): any; } ? Parameters<C['create']> :
            C extends new (args: any) => any ? ConstructorParameters<C> :
            never
    ): R {
        if ('create' in constructor) {
            const provider = constructor.create.apply(constructor, args);

            return provider instanceof Promise ?
                provider.then(provider => new Storage(provider)) as R :
                new Storage(provider) as R;
        }

        const provider = new (constructor as new (...args: any) => StorageProvider)(...args);
        return new Storage(provider) as R;
    }
}

export class NintendoAccountSession<
    T
> {
    readonly na_id: string;
    readonly client_id: string;
    readonly jwt: Jwt<NintendoAccountSessionTokenJwtPayload>;
    // private readonly jwt_sig: Buffer;

    constructor(
        readonly storage: Storage,
        readonly token: string,
        na_id?: string,
        client_id?: string,
    ) {
        const [jwt, jwt_sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);

        if (jwt.payload.iss !== 'https://accounts.nintendo.com') {
            throw new Error('Invalid Nintendo Account session token issuer');
        }
        if (jwt.payload.typ !== 'session_token') {
            throw new Error('Invalid Nintendo Account session token type');
        }
        // if (jwt.payload.aud !== ZNCA_CLIENT_ID) {
        //     throw new Error('Invalid Nintendo Account session token audience');
        // }
        if (client_id && jwt.payload.aud !== client_id) {
            throw new Error('Invalid Nintendo Account session token audience');
        }
        if (na_id && jwt.payload.sub !== na_id) {
            throw new Error('Invalid Nintendo Account session token subject');
        }
        if (jwt.payload.exp <= (Date.now() / 1000)) {
            throw new Error('Nintendo Account session token expired');
        }

        this.jwt = jwt;
        this.na_id = na_id ?? jwt.payload.sub;
        this.client_id = client_id ?? jwt.payload.aud;
    }

    get user_id() {
        return this.jwt.payload.sub;
    }

    get session_id() {
        return '' + this.jwt.payload.jti;
    }

    async getItem<T>(key: string) {
        return this.storage.getJsonSessionItem<T>(this.na_id, this.session_id, key);
    }

    async setItem<T>(key: string, data: T) {
        return this.storage.setJsonSessionItem(this.na_id, this.session_id, key, data);
    }

    async getNintendoAccountToken() {
        return this.storage.getJsonSessionItem<SavedNaToken>(this.na_id, this.session_id, 'NintendoAccountToken');
    }

    async setNintendoAccountToken(data: SavedNaToken) {
        return this.storage.setJsonSessionItem(this.na_id, this.session_id, 'NintendoAccountToken', data);
    }

    async getAuthenticationData() {
        return this.storage.getJsonSessionItem<T>(this.na_id, this.session_id, 'AuthenticationData');
    }

    async setAuthenticationData(data: T) {
        return this.storage.setJsonSessionItem(this.na_id, this.session_id, 'AuthenticationData', data);
    }

    async getRateLimitAttempts(key: string) {
        const attempts =
            await this.storage.getJsonSessionItem<number[]>(this.na_id, this.session_id, 'RateLimitAttempts-' + key);
        return attempts ?? [];
    }

    async setRateLimitAttempts(key: string, attempts: number[]) {
        await this.storage.setJsonSessionItem(this.na_id, this.session_id, 'RateLimitAttempts-' + key, attempts);
    }
}
