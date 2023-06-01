import createDebug from '../util/debug.js';
import { NintendoAccountSession } from './storage/index.js';
import { getNintendoAccountToken, getNintendoAccountUser, NintendoAccountToken, NintendoAccountUser } from '../api/na.js';

const debug = createDebug('nxapi:client:na');

export interface SavedToken {
    token: NintendoAccountToken;
    created_at: number;
    expires_at: number;
}

export default class NintendoAccountOIDC {
    created_at = Date.now();
    expires_at = Infinity;

    promise = new Map<string, Promise<void>>();

    updated = {
        token: null as number | null,
        user: null as number | null,
    };
    update_interval = 10 * 1000; // 10 seconds

    user: NintendoAccountUser | null = null;

    onUpdateSavedToken: ((data: SavedToken) => Promise<void>) | null = null;

    constructor(
        readonly token: string,
        readonly client_id: string,
        public data: SavedToken,
    ) {
        this.updated.token = data.created_at;
    }

    private async update(key: keyof NintendoAccountOIDC['updated'], callback: () => Promise<void>, ttl: number) {
        if (((this.updated[key] ?? 0) + ttl) < Date.now()) {
            const promise = this.promise.get(key) ?? callback.call(null).then(() => {
                this.updated[key] = Date.now();
                this.promise.delete(key);
            }).catch(err => {
                this.promise.delete(key);
                throw err;
            });

            this.promise.set(key, promise);

            await promise;
        } else {
            debug('Not updating %s data for Nintendo Account user %s', key, this.user);
        }
    }

    async getToken() {
        if (this.data.expires_at > Date.now()) return this.data.token;

        await this.update('token', async () => {
            const token = await getNintendoAccountToken(this.token, this.client_id);

            this.data = {
                token,
                created_at: Date.now(),
                expires_at: Date.now() + (token.expires_in * 1000),
            };

            await this.onUpdateSavedToken?.(this.data);
        }, 0);

        return this.data.token;
    }

    async getUser() {
        await this.update('user', async () => {
            const token = await this.getToken();
            this.user = await getNintendoAccountUser(token);
        }, this.update_interval);

        return this.user!;
    }

    static async createWithSession(session: NintendoAccountSession<unknown>, renew_token = true) {
        const cached_auth_data = await session.getNintendoAccountToken();

        if (cached_auth_data && (cached_auth_data.expires_at > Date.now() || !renew_token)) {
            const client = new NintendoAccountOIDC(session.token, session.client_id, cached_auth_data);
            client.onUpdateSavedToken = data => session.setNintendoAccountToken(data);
            return client;
        }

        const token = await getNintendoAccountToken(session.token, session.client_id);

        const auth_data: SavedToken = {
            token,
            created_at: Date.now(),
            expires_at: Date.now() + (token.expires_in * 1000),
        };

        await session.setNintendoAccountToken(auth_data);

        const client = new NintendoAccountOIDC(session.token, session.client_id, auth_data);
        client.onUpdateSavedToken = data => session.setNintendoAccountToken(data);
        return client;
    }
}
