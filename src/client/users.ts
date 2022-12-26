import { NintendoAccountSession, Storage } from './storage/index.js';

interface UserConstructor<T extends User, A extends any[] = unknown[]> {
    createWithUserStore(users: Users, id: string, ...args: A): Promise<T>;
}

interface User {
    expires_at: number;
}

export default class Users {
    private users = new Map<UserConstructor<User>, Map<string, User>>();
    private user_promise = new Map<UserConstructor<User>, Map<string, Promise<User>>>();

    constructor(
        readonly storage: Storage,
        readonly znc_proxy_url?: string,
    ) {}

    async get<T extends User, A extends any[]>(type: UserConstructor<T, A>, id: string, ...args: A): Promise<T> {
        const existing = this.users.get(type)?.get(id);

        if (existing && existing.expires_at >= Date.now()) {
            return existing as T;
        }

        const promises = this.user_promise.get(type) ?? new Map<string, Promise<T>>();

        const promise = promises.get(id) ?? type.createWithUserStore(this, id, ...args).then(client => {
            const users = this.users.get(type) ?? new Map<string, T>();
            users.set(id, client);
            return client;
        }).finally(() => {
            promises.delete(id);
            if (!promises.size) this.user_promise.delete(type);
        });

        this.user_promise.set(type, promises);
        promises.set(id, promise);

        return promise as Promise<T>;
    }
}
