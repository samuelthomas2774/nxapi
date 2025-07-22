import * as crypto from 'node:crypto';
import * as persist from 'node-persist';
import { Response } from 'undici';
import createDebug from '../util/debug.js';
import CoralApi, { CoralApiInterface, NintendoAccountUserCoral, Result } from '../api/coral.js';
import ZncProxyApi from '../api/znc-proxy.js';
import { Announcements, Friends, Friend, GetActiveEventResult, CoralSuccessResponse, WebService, WebServices, CoralError, Announcements_4, Friends_4, WebServices_4, ListMedia, ListChat, WebService_4, CurrentUser } from '../api/coral-types.js';
import { getToken, SavedToken } from './auth/coral.js';
import type { Store } from '../app/main/index.js';

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

    async remove(token: string) {
        const promise = this.promise.get(token);
        this.promise.delete(token);

        await promise;
        this.users.delete(token);
    }

    static coral(store: Store | persist.LocalStorage, znc_proxy_url: string, ratelimit?: boolean): Users<CoralUser<ZncProxyApi>>
    static coral(store: Store | persist.LocalStorage, znc_proxy_url?: undefined, ratelimit?: boolean): Users<CoralUser<CoralApi>>
    static coral(store: Store | persist.LocalStorage, znc_proxy_url?: string, ratelimit?: boolean): Users<CoralUser<CoralApiInterface>>
    static coral(_store: Store | persist.LocalStorage, znc_proxy_url?: string, ratelimit?: boolean) {
        const store = 'storage' in _store ? _store : null;
        const storage = 'storage' in _store ? _store.storage : _store;

        const cached_webservices = new Map</** language */ string, string>();

        return new Users(async token => {
            const {nso, data} = await getToken(storage, token, znc_proxy_url, ratelimit);

            const [announcements, friends, webservices, chats, media, active_event, coral_user] = await Promise.all([
                nso.getAnnouncements(),
                nso.getFriendList(),
                nso.getWebServices(),
                nso.getChats(),
                nso.getMedia(),
                nso.getActiveEvent(),
                nso.getCurrentUser(),
            ]);

            const user = new CoralUser(
                nso, data,
                announcements, friends, webservices, chats, media, active_event, coral_user,
            );

            if (nso instanceof CoralApi && nso.onTokenExpired) {
                const renewToken = nso.onTokenExpired;

                nso.onTokenExpired = async (error?: CoralError, response?: Response) => {
                    const auth_data = await renewToken(error, response) as SavedToken;
                    user.data = auth_data;
                    return auth_data;
                };
            }

            if (store) {
                await maybeUpdateWebServicesListCache(cached_webservices, store, data.user, webservices);
                user.onUpdatedWebServices = webservices => {
                    maybeUpdateWebServicesListCache(cached_webservices, store, data.user, webservices);
                };
            }

            return user;
        });
    }
}

export interface CoralUserData<T extends CoralApiInterface = CoralApi> extends UserData {
    nso: T;
    data: SavedToken;
    announcements: CoralSuccessResponse<Announcements_4>;
    friends: CoralSuccessResponse<Friends_4>;
    webservices: CoralSuccessResponse<WebServices_4>;
    chats: CoralSuccessResponse<ListChat>;
    media: CoralSuccessResponse<ListMedia>;
    active_event: CoralSuccessResponse<GetActiveEventResult>;
    user: CoralSuccessResponse<CurrentUser>;
}

export class CoralUser<T extends CoralApiInterface = CoralApi> implements CoralUserData<T> {
    created_at = Date.now();
    expires_at = Infinity;

    promise = new Map<string, Promise<void>>();
    delay_retry_after_error_until: number | null = null;

    updated = {
        announcements: Date.now(),
        friends: Date.now(),
        webservices: Date.now(),
        chats: Date.now(),
        media: Date.now(),
        active_event: Date.now(),
        user: Date.now(),
    };

    delay_retry_after_error = 5 * 1000; // 5 seconds
    update_interval = 10 * 1000; // 10 seconds

    onUpdatedWebServices: ((webservices: Result<WebServices_4>) => void) | null = null;

    constructor(
        public nso: T,
        public data: SavedToken,
        public announcements: CoralSuccessResponse<Announcements_4>,
        public friends: CoralSuccessResponse<Friends_4>,
        public webservices: CoralSuccessResponse<WebServices_4>,
        public chats: CoralSuccessResponse<ListChat>,
        public media: CoralSuccessResponse<ListMedia>,
        public active_event: CoralSuccessResponse<GetActiveEventResult>,
        public user: CoralSuccessResponse<CurrentUser>,
    ) {}

    private async update(key: keyof CoralUser['updated'], callback: () => Promise<void>, ttl: number) {
        if ((this.updated[key] + ttl) < Date.now()) {
            const promise = this.promise.get(key) ?? Promise.resolve().then(() => {
                const delay_retry = (this.delay_retry_after_error_until ?? 0) - Date.now();

                return delay_retry > 0 ? new Promise(rs => setTimeout(rs, delay_retry)) : null;
            }).then(() => callback.call(null)).then(() => {
                this.updated[key] = Date.now();
                this.delay_retry_after_error_until = null;
                this.promise.delete(key);
            }).catch(err => {
                this.delay_retry_after_error_until = Date.now() + this.delay_retry_after_error;
                this.promise.delete(key);
                throw err;
            });

            this.promise.set(key, promise);

            await promise;
        } else {
            debug('Not updating %s data for coral user %s', key, this.data.nsoAccount.user.name);
        }
    }

    async getAnnouncements() {
        await this.update('announcements', async () => {
            // Always requested together when refreshing notifications page
            this.getWebServices();

            this.announcements = await this.nso.getAnnouncements();
        }, this.update_interval);

        return this.announcements.result;
    }

    async getFriends() {
        await this.update('friends', async () => {
            // No simultaneous requests when refreshing friend list page

            this.friends = await this.nso.getFriendList();
        }, this.update_interval);

        return this.friends.result.friends;
    }

    async getWebServices() {
        await this.update('webservices', async () => {
            // Always requested together when refreshing notifications page
            this.getAnnouncements();

            const webservices = this.webservices = await this.nso.getWebServices();

            this.onUpdatedWebServices?.call(null, webservices);
        }, this.update_interval);

        return this.webservices.result;
    }

    async getChats() {
        await this.update('chats', async () => {
            // Always requested together when refreshing main page
            Promise.all([
                this.getAnnouncements(),
                this.getFriends(),
                this.getWebServices(),
                this.getMedia(),
                this.getActiveEvent(),
            ]);

            this.chats = await this.nso.getChats();
        }, this.update_interval);

        return this.chats.result;
    }

    async getMedia() {
        await this.update('media', async () => {
            // No simultaneous requests when refreshing media page

            this.media = await this.nso.getMedia();
        }, this.update_interval);

        return this.media.result.media;
    }

    async getActiveEvent() {
        await this.update('active_event', async () => {
            // Always requested together when refreshing main page
            Promise.all([
                this.getAnnouncements(),
                this.getFriends(),
                this.getWebServices(),
                this.getChats(),
                this.getMedia(),
            ]);

            this.active_event = await this.nso.getActiveEvent();
        }, this.update_interval);

        return this.active_event.result;
    }

    async getCurrentUser() {
        await this.update('user', async () => {
            // Always requested together when refreshing main page
            Promise.all([
                this.getAnnouncements(),
                this.getFriends(),
                this.getWebServices(),
                this.getChats(),
                this.getMedia(),
            ]);

            // or, then user page requests /v4/User/ShowSelf, /v3/User/Permissions/ShowSelf, /v4/User/PlayLog/Show

            this.user = await this.nso.getCurrentUser();
        }, this.update_interval);

        return this.user.result;
    }

    async addFriend(nsa_id: string) {
        if (!(this.nso instanceof CoralApi)) {
            throw new Error('Cannot send friend requests using Coral API proxy');
        }

        if (nsa_id === this.data.nsoAccount.user.nsaId) {
            throw new Error('Cannot add self as a friend');
        }

        const result = await this.nso.sendFriendRequest(nsa_id);

        // Check if the user is now friends
        // The Nintendo Switch Online app doesn't do this, but if the other user already sent a friend request to
        // this user, they will be added as friends immediately. If the user is now friends we can show a message
        // saying that, instead of saying that a friend request was sent when the user actually just accepted the
        // other user's friend request.
        let friend: Friend | null = null;

        try {
            // Clear the last updated timestamp to force updating the friend list
            this.updated.friends = 0;

            const friends = await this.getFriends();
            friend = friends.find(f => f.nsaId === nsa_id) ?? null;
        } catch (err) {
            debug('Error updating friend list for %s to check if a friend request was accepted',
                this.data.nsoAccount.user.name, err);
        }

        return {result, friend};
    }
}

export interface CachedWebServicesList {
    webservices: WebService[];
    updated_at: number;
    language: string;
    user: string;
}

async function maybeUpdateWebServicesListCache(
    cached_webservices: Map<string, string>, store: Store, // storage: persist.LocalStorage,
    user: NintendoAccountUserCoral, webservices: WebService_4[]
) {
    const webservices_hash = crypto.createHash('sha256').update(JSON.stringify(webservices)).digest('hex');
    if (cached_webservices.get(user.language) === webservices_hash) return;

    debug('Updating web services list', user.language);

    const cache: CachedWebServicesList = {
        webservices,
        updated_at: Date.now(),
        language: user.language,
        user: user.id,
    };

    await store.storage.setItem('CachedWebServicesList.' + user.language, cache);
    cached_webservices.set(user.language, webservices_hash);
    store?.emit('update-cached-web-services', user.language, cache);
}
