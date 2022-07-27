import createDebug from 'debug';
import * as persist from 'node-persist';
import CoralApi from '../api/coral.js';
import ZncProxyApi from '../api/znc-proxy.js';
import { Announcements, Friends, GetActiveEventResult, WebServices, CoralSuccessResponse } from '../api/coral-types.js';
import { getToken, SavedToken } from './auth/coral.js';

const debug = createDebug('nxapi:users');

export interface UserData {
    created_at: number;
    expires_at: number;
}

export default class Users<T extends UserData> {
    private users = new Map<string, T>();
    private promise = new Map<string, Promise<T>>();
    private _get: (token: string) => Promise<T>;

    constructor(get: (token: string) => Promise<T>) {
        this._get = get;
    }

    async get(token: string): Promise<T> {
        const existing = this.users.get(token);

        if (existing && existing.expires_at >= Date.now()) {
            return existing;
        }

        const promise = this.promise.get(token) ?? this._get.call(null, token).then(data => {
            this.users.set(token, data);
            return data;
        }).finally(() => {
            this.promise.delete(token);
        });

        this.promise.set(token, promise);

        return promise;
    }

    static coral(storage: persist.LocalStorage, znc_proxy_url: string, ratelimit?: boolean): Users<CoralUser<ZncProxyApi>>
    static coral(storage: persist.LocalStorage, znc_proxy_url?: string, ratelimit?: boolean): Users<CoralUser>
    static coral(storage: persist.LocalStorage, znc_proxy_url?: string, ratelimit?: boolean) {
        return new Users(async token => {
            const {nso, data} = await getToken(storage, token, znc_proxy_url, ratelimit);

            const [announcements, friends, webservices, active_event] = await Promise.all([
                nso.getAnnouncements(),
                nso.getFriendList(),
                nso.getWebServices(),
                nso.getActiveEvent(),
            ]);

            return new CoralUser(nso, data, announcements, friends, webservices, active_event);
        });
    }
}

export interface CoralUserData<T extends CoralApi = CoralApi> extends UserData {
    nso: T;
    data: SavedToken;
    announcements: CoralSuccessResponse<Announcements>;
    friends: CoralSuccessResponse<Friends>;
    webservices: CoralSuccessResponse<WebServices>;
    active_event: CoralSuccessResponse<GetActiveEventResult>;
}

export class CoralUser<T extends CoralApi = CoralApi> implements CoralUserData<T> {
    created_at = Date.now();
    expires_at = Infinity;

    promise = new Map<string, Promise<void>>();

    updated = {
        announcements: Date.now(),
        friends: Date.now(),
        webservices: Date.now(),
        active_event: Date.now(),
    };

    constructor(
        public nso: T,
        public data: SavedToken,
        public announcements: CoralSuccessResponse<Announcements>,
        public friends: CoralSuccessResponse<Friends>,
        public webservices: CoralSuccessResponse<WebServices>,
        public active_event: CoralSuccessResponse<GetActiveEventResult>,
    ) {}

    private async update(key: keyof CoralUser['updated'], callback: () => Promise<void>, ttl: number) {
        if ((this.updated[key] + ttl) < Date.now()) {
            const promise = this.promise.get(key) ?? callback.call(null).then(() => {
                this.updated[key] = Date.now();
            }).finally(() => {
                this.promise.delete(key);
            });

            this.promise.set(key, promise);

            await promise;
        } else {
            debug('Not updating %s data for coral user %s', key, this.data.nsoAccount.user.name);
        }
    }

    async getAnnouncements() {
        await this.update('announcements', async () => {
            this.announcements = await this.nso.getAnnouncements();
        }, 30 * 60 * 1000);

        return this.announcements.result;
    }

    async getFriends() {
        await this.update('friends', async () => {
            this.friends = await this.nso.getFriendList();
        }, 10 * 1000);

        return this.friends.result.friends;
    }

    async getWebServices() {
        await this.update('webservices', async () => {
            this.webservices = await this.nso.getWebServices();
        }, 10 * 1000);

        return this.webservices.result;
    }

    async getActiveEvent() {
        await this.update('active_event', async () => {
            this.active_event = await this.nso.getActiveEvent();
        }, 10 * 1000);

        return this.active_event.result;
    }
}
