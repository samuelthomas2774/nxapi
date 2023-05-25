import createDebug from 'debug';
import { Response } from 'node-fetch';
import { ConfigureAnalyticsResult, CurrentFestResult, DetailVotingStatusResult, FriendListResult, Friend_friendList, HomeResult, StageScheduleResult } from 'splatnet3-types/splatnet3';
import { ZNCA_CLIENT_ID } from '../api/coral.js';
import { NintendoAccountSession, Storage } from './storage/index.js';
import SplatNet3Api, { PersistedQueryResult, SplatNet3AuthData } from '../api/splatnet3.js';
import Coral, { SavedToken as SavedCoralToken } from './coral.js';
import { ErrorResponse } from '../api/util.js';
import Users from './users.js';
import { checkUseLimit } from './util.js';

const debug = createDebug('nxapi:client:splatnet3');

export interface SavedToken extends SplatNet3AuthData {
    // expires_at: number;
}

export default class SplatNet3 {
    created_at = Date.now();
    expires_at = Infinity;

    friends: PersistedQueryResult<FriendListResult> | null = null;
    // schedules: PersistedQueryResult<StageScheduleResult> | null = null;

    promise = new Map<string, Promise<void>>();

    updated = {
        configure_analytics: null as number | null,
        current_fest: null as number | null,
        home: null as number | null,
        friends: null as number | null,
        schedules: null as number | null,
    };
    update_interval = 10 * 1000; // 10 seconds
    update_interval_schedules = 60 * 60 * 1000; // 60 minutes

    constructor(
        public api: SplatNet3Api,
        public data: SplatNet3AuthData,
        public configure_analytics: PersistedQueryResult<ConfigureAnalyticsResult> | null = null,
        public current_fest: PersistedQueryResult<CurrentFestResult> | null = null,
        public home: PersistedQueryResult<HomeResult> | null = null,
    ) {
        if (configure_analytics) this.updated.configure_analytics = Date.now();
        if (current_fest) this.updated.current_fest = Date.now();
        if (home) this.updated.home = Date.now();
    }

    protected async update(key: keyof SplatNet3['updated'], callback: () => Promise<void>, ttl: number) {
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
            debug('Not updating %s data for SplatNet 3 user', key);
        }
    }

    async getHome(): Promise<HomeResult> {
        await this.update('home', async () => {
            this.home = await this.api.getHome();
        }, this.update_interval);

        return this.home!.data;
    }

    async getFriends(): Promise<Friend_friendList[]> {
        await this.update('friends', async () => {
            this.friends = this.friends ?
                await this.api.getFriendsRefetch() :
                await this.api.getFriends();
        }, this.update_interval);

        return this.friends!.data.friends.nodes;
    }

    static async create(storage: Storage, coral: Coral) {
        const session = await storage.getSession<SavedCoralToken>(coral.data.user.id, ZNCA_CLIENT_ID);
        if (!session) throw new Error('Unknown user');

        return this.createWithSession(session, coral);
    }

    static async createWithSession(session: NintendoAccountSession<SavedCoralToken>, coral: Coral) {
        const cached_auth_data = await session.getItem<SavedToken>('BulletToken');

        const [splatnet, auth_data, skip_fetch] = cached_auth_data && cached_auth_data.expires_at > Date.now() ?
            [SplatNet3Api.createWithSavedToken(cached_auth_data), cached_auth_data, true] :
            await this.createWithSessionAuthenticate(session, coral);

        const renew_token_data = {coral, auth_data};
        splatnet.onTokenExpired = createTokenExpiredHandler(session, splatnet, renew_token_data);
        splatnet.onTokenShouldRenew = createTokenShouldRenewHandler(session, splatnet, renew_token_data);

        return this.createWithSplatNet3Api(splatnet, auth_data, skip_fetch);
    }

    private static async createWithSessionAuthenticate(
        session: NintendoAccountSession<SavedCoralToken>, coral: Coral, ratelimit = true
    ) {
        await checkUseLimit(session, 'bullet', ratelimit);

        const {splatnet, data} = await SplatNet3Api.createWithCoral(coral.api, coral.data.user);

        await session.setItem<SavedToken>('BulletToken', data);

        return [splatnet, data] as const;
    }

    static async createWithSplatNet3Api(splatnet: SplatNet3Api, data: SavedToken, skip_fetch = true) {
        const home = skip_fetch ? null : await splatnet.getHome();

        const [configure_analytics, current_fest] = skip_fetch ? [null, null] : await Promise.all([
            splatnet.getConfigureAnalytics().catch(err => {
                debug('Error in ConfigureAnalyticsQuery request', err);
            }),
            splatnet.getCurrentFest().catch(err => {
                debug('Error in useCurrentFest request', err);
            }),
        ]);

        return new SplatNet3(splatnet, data, configure_analytics ?? null, current_fest ?? null, home);
    }

    static async createWithUserStore(users: Users, id: string) {
        const session = await users.storage.getSession<SavedCoralToken>(id, ZNCA_CLIENT_ID);

        if (!session) {
            throw new Error('Unknown user');
        }

        const coral = await users.get(Coral, id);

        return SplatNet3.createWithSession(session, coral);
    }
}

function createTokenExpiredHandler(
    session: NintendoAccountSession<SavedCoralToken>, splatnet: SplatNet3Api,
    data: {coral: Coral; auth_data: SavedToken; znc_proxy_url?: string},
    ratelimit = true
) {
    return (response?: Response) => {
        debug('Token expired, renewing');
        return renewToken(session, splatnet, data, ratelimit);
    };
}

function createTokenShouldRenewHandler(
    session: NintendoAccountSession<SavedCoralToken>, splatnet: SplatNet3Api,
    data: {coral: Coral; auth_data: SavedToken; znc_proxy_url?: string},
    ratelimit = true
) {
    return (remaining: number, response: Response) => {
        debug('Token will expire in %d seconds, renewing', remaining);
        return renewToken(session, splatnet, data, ratelimit);
    };
}

async function renewToken(
    session: NintendoAccountSession<SavedCoralToken>, splatnet: SplatNet3Api,
    renew_token_data: {coral: Coral; auth_data: SavedToken; znc_proxy_url?: string}, ratelimit = true
) {
    await checkUseLimit(session, 'bullet', ratelimit);

    try {
        const coral_auth_data = renew_token_data.coral.data ?? await session.getAuthenticationData();

        if (coral_auth_data) {
            const data = await splatnet.renewTokenWithWebServiceToken(
                renew_token_data.auth_data.webserviceToken, coral_auth_data.user);

            const auth_data: SavedToken = {
                ...renew_token_data.auth_data,
                ...data,
            };

            await session.setItem<SavedToken>('BulletToken', auth_data);
            renew_token_data.auth_data = auth_data;

            return;
        } else {
            debug('Unable to renew bullet token with saved web services token - cached data for this session token doesn\'t exist??');
        }
    } catch (err) {
        if (err instanceof ErrorResponse && err.response.status === 401) {
            // Web service token invalid/expired...
            debug('Web service token expired, authenticating with new token', err);
        } else {
            throw err;
        }
    }

    const coral = renew_token_data.coral;

    const data = await splatnet.renewTokenWithCoral(coral.api, coral.data.user);

    const auth_data: SavedToken = {
        ...renew_token_data.auth_data,
        ...data,
    };

    await session.setItem<SavedToken>('BulletToken', auth_data);
    renew_token_data.auth_data = auth_data;
}
