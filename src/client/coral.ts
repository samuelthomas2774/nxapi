import { Response } from 'undici';
import CoralApi, { CoralApiInterface, CoralAuthData, Result, ZNCA_CLIENT_ID } from '../api/coral.js';
import { Announcements, Friends, Friend, GetActiveEventResult, WebServices, CoralError } from '../api/coral-types.js';
import ZncProxyApi from '../api/znc-proxy.js';
import { NintendoAccountSession, Storage } from './storage/index.js';
import { checkUseLimit } from './util.js';
import createDebug from '../util/debug.js';
import { ArgumentsCamelCase } from '../util/yargs.js';
import { initStorage } from '../util/storage.js';
import NintendoAccountOIDC from './na.js';
import Users from './users.js';

const debug = createDebug('nxapi:client:coral');

export interface SavedToken extends CoralAuthData {
    expires_at: number;
    proxy_url?: string;
}

export default class Coral {
    created_at = Date.now();
    expires_at = Date.now() + (2 * 60 * 60 * 1000);

    promise = new Map<string, Promise<void>>();

    updated = {
        announcements: null as number | null,
        friends: null as number | null,
        webservices: null as number | null,
        active_event: null as number | null,
    };
    update_interval = 10 * 1000; // 10 seconds
    update_interval_announcements = 30 * 60 * 1000; // 30 minutes

    onUpdatedWebServices: ((webservices: Result<WebServices>) => void) | null = null;

    constructor(
        public api: CoralApiInterface,
        public data: CoralAuthData,
        public announcements: Result<Announcements> | null = null,
        public friends: Result<Friends> | null = null,
        public webservices: Result<WebServices> | null = null,
        public active_event: Result<GetActiveEventResult> | null = null,
    ) {
        if (announcements) this.updated.announcements = Date.now();
        if (friends) this.updated.friends = Date.now();
        if (webservices) this.updated.webservices = Date.now();
        if (active_event) this.updated.active_event = Date.now();
    }

    private update(key: keyof Coral['updated'], callback: () => Promise<void>, ttl: number) {
        if (((this.updated[key] ?? 0) + ttl) < Date.now()) {
            const promise = this.promise.get(key) ?? Promise.resolve().then(() => callback.call(null)).then(() => {
                this.updated[key] = Date.now();
                this.promise.delete(key);
            }).catch(err => {
                this.promise.delete(key);
                throw err;
            });

            this.promise.set(key, promise);

            return promise;
        } else {
            debug('Not updating %s data for coral user %s', key, this.data.nsoAccount.user.name);
        }
    }

    get user() {
        return this.data.nsoAccount.user;
    }

    async getAnnouncements() {
        await this.update('announcements', async () => {
            this.getFriends();
            this.getWebServices();
            this.getActiveEvent();

            this.announcements = await this.api.getAnnouncements();
        }, this.update_interval_announcements);

        return this.announcements!;
    }

    async getFriends() {
        await this.update('friends', async () => {
            this.friends = await this.api.getFriendList();
        }, this.update_interval);

        return this.friends!.friends;
    }

    async getWebServices() {
        await this.update('webservices', async () => {
            this.getFriends();
            this.getActiveEvent();

            const webservices = this.webservices = await this.api.getWebServices();

            this.onUpdatedWebServices?.call(null, webservices);
        }, this.update_interval);

        return this.webservices!;
    }

    async getActiveEvent() {
        await this.update('active_event', async () => {
            this.getFriends();
            this.getWebServices();

            this.active_event = await this.api.getActiveEvent();
        }, this.update_interval);

        return 'id' in this.active_event! ? this.active_event : null;
    }

    async addFriend(nsa_id: string) {
        if (!(this.api instanceof CoralApi)) {
            throw new Error('Cannot send friend requests using Coral API proxy');
        }

        if (nsa_id === this.data.nsoAccount.user.nsaId) {
            throw new Error('Cannot add self as a friend');
        }

        const result = await this.api.sendFriendRequest(nsa_id);

        // Check if the user is now friends
        // The Nintendo Switch Online app doesn't do this, but if the other user already sent a friend request to
        // this user, they will be added as friends immediately. If the user is now friends we can show a message
        // saying that, instead of saying that a friend request was sent when the user actually just accepted the
        // other user's friend request.
        let friend: Friend | null = null;

        try {
            // Clear the last updated timestamp to force updating the friend list
            this.updated.friends = null;

            const friends = await this.getFriends();
            friend = friends.find(f => f.nsaId === nsa_id) ?? null;
        } catch (err) {
            debug('Error updating friend list for %s to check if a friend request was accepted',
                this.data.nsoAccount.user.name, err);
        }

        return {result, friend};
    }

    static async create(storage: Storage, na_id: string, proxy_url?: string) {
        const session = await storage.getSession<SavedToken>(na_id, ZNCA_CLIENT_ID);
        if (!session) throw new Error('Unknown user');

        if (proxy_url) {
            return this.createWithProxy(session, proxy_url);
        }

        const oidc = await NintendoAccountOIDC.createWithSession(session, false);

        return this.createWithSession(session, oidc);
    }

    static async createWithSession(session: NintendoAccountSession<SavedToken>, oidc: NintendoAccountOIDC) {
        const cached_auth_data = await session.getAuthenticationData();

        const [coral, auth_data, skip_fetch] = cached_auth_data && cached_auth_data.expires_at > Date.now() ?
            [CoralApi.createWithSavedToken(cached_auth_data), cached_auth_data, true] :
            await this.createWithSessionAuthenticate(session, oidc);

        return this.createWithCoralApi(coral, auth_data, skip_fetch);
    }

    private static async createWithSessionAuthenticate(
        session: NintendoAccountSession<SavedToken>, oidc: NintendoAccountOIDC, ratelimit = true
    ) {
        await checkUseLimit(session, 'coral', ratelimit);

        console.warn('Authenticating to Nintendo Switch Online app');
        debug('Authenticating to znc with session token');

        const [token, user] = await Promise.all([
            oidc.getToken(),
            oidc.getUser(),
        ]);
    
        const {nso, data} = await CoralApi.createWithNintendoAccountToken(token, user);

        const auth_data: SavedToken = {
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        await session.setAuthenticationData(auth_data);

        return [nso, auth_data] as const;
    }

    static async createWithProxy(session: NintendoAccountSession<SavedToken>, proxy_url: string) {
        const cached_auth_data = await session.getAuthenticationData();

        const [coral, auth_data, skip_fetch] = cached_auth_data && cached_auth_data.expires_at > Date.now() ?
            [new ZncProxyApi(proxy_url, session.token), cached_auth_data, true] :
            await this.createWithProxyAuthenticate(session, proxy_url);

        return this.createWithCoralApi(coral, auth_data, skip_fetch);
    }

    private static async createWithProxyAuthenticate(
        session: NintendoAccountSession<SavedToken>, proxy_url: string, ratelimit = true
    ) {
        await checkUseLimit(session, 'coral', ratelimit);

        console.warn('Authenticating to Nintendo Switch Online app');
        debug('Authenticating to znc with session token');

        const {nso, data} = await ZncProxyApi.createWithSessionToken(proxy_url, session.token);

        const auth_data: SavedToken = {
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        await session.setAuthenticationData(auth_data);

        return [nso, auth_data] as const;
    }

    static async createWithCoralApi(coral: CoralApiInterface, data: SavedToken, skip_fetch = false) {
        if (skip_fetch) {
            debug('Already authenticated, skip fetching coral data');
            return new Coral(coral, data, null, null, null, null);
        }

        const [announcements, friends, webservices, active_event] = await Promise.all([
            coral.getAnnouncements(),
            coral.getFriendList(),
            coral.getWebServices(),
            coral.getActiveEvent(),
        ]);

        return new Coral(coral, data, announcements, friends, webservices, active_event);
    }

    static async createWithUserStore(users: Users, id: string) {
        const session = await users.storage.getSession<SavedToken>(id, ZNCA_CLIENT_ID);

        if (!session) {
            throw new Error('Unknown user');
        }

        if (users.znc_proxy_url) {
            return Coral.createWithProxy(session, users.znc_proxy_url);
        }

        // const oidc = await users.get(NintendoAccountOIDC, id, false);
        const oidc = await NintendoAccountOIDC.createWithSession(session, false);

        return Coral.createWithSession(session, oidc);
    }
}

function createTokenExpiredHandler(
    session: NintendoAccountSession<SavedToken>, coral: CoralApi,
    renew_token_data: {auth_data: SavedToken}, ratelimit = true
) {
    return (data: CoralError, response: Response) => {
        debug('Token expired', renew_token_data.auth_data.user.id, data);
        return renewToken(session, coral, renew_token_data, ratelimit);
    };
}

async function renewToken(
    session: NintendoAccountSession<SavedToken>, coral: CoralApi,
    renew_token_data: {auth_data: SavedToken}, ratelimit = true
) {
    // if (ratelimit) {
    //     const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(token);    
    //     await checkUseLimit(storage, 'coral', jwt.payload.sub, ratelimit);
    // }

    await checkUseLimit(session, 'coral', ratelimit);

    const data = await coral.renewToken(session.token, renew_token_data.auth_data.user);

    const auth_data: SavedToken = {
        ...renew_token_data.auth_data,
        ...data,
        expires_at: Date.now() + (data.credential.expiresIn * 1000),
    };

    await session.setAuthenticationData(auth_data);
    renew_token_data.auth_data = auth_data;
}

export async function getCoralClientFromArgv(storage: Storage, argv: ArgumentsCamelCase<{
    'data-path': string;
    user?: string;
    token?: string;
    'znc-proxy-url'?: string;
}>) {
    // const storage = await Storage.create(LocalStorageProvider, argv.dataPath);

    if (argv.token) {
        const session = new NintendoAccountSession<SavedToken>(storage, argv.token, undefined, ZNCA_CLIENT_ID);
        return argv.zncProxyUrl ?
            Coral.createWithProxy(session, argv.zncProxyUrl) :
            Coral.createWithSession(session, await NintendoAccountOIDC.createWithSession(session, false));
    }
    if (argv.user) {
        return Coral.create(storage, argv.user, argv.zncProxyUrl);
    }

    const persist = await initStorage(argv.dataPath);
    const user = await persist.getItem('SelectedUser');

    if (!user) {
        throw new Error('No user selected');
    }

    return Coral.create(storage, user, argv.zncProxyUrl);
}
