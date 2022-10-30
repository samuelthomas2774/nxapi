import * as net from 'node:net';
import createDebug from 'debug';
import * as persist from 'node-persist';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidgen } from 'uuid';
import { Announcement, CoralStatus, CurrentUser, Friend, FriendCodeUrl, FriendCodeUser, Presence } from '../../api/coral-types.js';
import CoralApi from '../../api/coral.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { SavedToken } from '../../common/auth/coral.js';
import { NotificationManager, PresenceEvent, ZncNotifications } from '../../common/notify.js';
import { product } from '../../util/product.js';
import { parseListenAddress } from '../../util/net.js';
import { AuthPolicy, AuthToken, ZncPresenceEventStreamEvent } from '../../api/znc-proxy.js';
import { addCliFeatureUserAgent } from '../../util/useragent.js';
import { ErrorResponse } from '../../api/util.js';
import Users, { CoralUser } from '../../common/users.js';
import { EventStreamResponse, HttpServer, ResponseError } from '../util/http-server.js';

declare global {
    namespace Express {
        interface Request {
            coralUser?: CoralUser;
            coral?: CoralApi;
            coralAuthData?: SavedToken;

            proxyAuthPolicy?: AuthPolicy;
            proxyAuthPolicyUser?: string;
            proxyAuthPolicyToken?: string;
        }
    }
}

interface RequestData {
    req: Request;
    res: Response;
    user?: CoralUser;
    policy?: AuthPolicy;
    token?: string;
}
interface RequestDataWithUser extends RequestData {
    user: CoralUser;
}

const debug = createDebug('cli:nso:http-server');

export const command = 'http-server';
export const desc = 'Starts a HTTP server to access the Nintendo Switch Online app API';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    }).option('require-token', {
        describe: 'Require Nintendo Account session token for all requests (if disabled the user query string parameter can be used to use the last token for that user)',
        type: 'boolean',
        default: true,
    }).option('update-interval', {
        describe: 'Max. update interval in seconds',
        type: 'number',
        default: 30,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    addCliFeatureUserAgent('http-server');

    const storage = await initStorage(argv.dataPath);

    const users = Users.coral(storage, argv.zncProxyUrl);

    const server = new Server(storage, users);
    server.require_token = argv.requireToken;
    server.update_interval = argv.updateInterval * 1000;
    const app = server.app;

    for (const address of argv.listen) {
        const [host, port] = parseListenAddress(address);
        const server = app.listen(port, host ?? '::');
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log('Listening on %s, port %d', address.address, address.port);
        });
    }
}

const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;

class Server extends HttpServer {
    require_token = true;
    update_interval = 30 * 1000;

    // Friend codes won't change very frequently, but associated data in the response
    // (user name/image) might change
    friendcode_update_interval = 24 * 60 * 60 * 1000; // 24 hours

    readonly app: express.Express;

    constructor(
        readonly storage: persist.LocalStorage,
        readonly users: Users<CoralUser>,
    ) {
        super();

        const app = this.app = express();

        app.use('/api/znc', (req, res, next) => {
            console.log('[%s] %s %s HTTP/%s from %s, port %d%s, %s',
                new Date(), req.method, req.path, req.httpVersion,
                req.socket.remoteAddress, req.socket.remotePort,
                req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
                req.headers['user-agent']);

            res.setHeader('Server', product + ' znc-proxy');

            next();
        });

        app.get('/api/znc/auth', this.createProxyRequestHandler(r => this.handleAuthRequest(r), true));

        app.get('/api/znc/token', this.authTokenMiddleware,
            this.createProxyRequestHandler(r => this.handleTokenRequest(r)));
        app.delete('/api/znc/token', this.authTokenMiddleware,
            this.createProxyRequestHandler(r => this.handleDeleteTokenRequest(r)));
        app.get('/api/znc/tokens', this.createProxyRequestHandler(r => this.handleTokensRequest(r), true));
        app.post('/api/znc/tokens', bodyParser.json(),
            this.createProxyRequestHandler(r => this.handleCreateTokenRequest(r), true));

        app.get('/api/znc/announcements', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleCreateTokenRequest(r), true));

        app.get('/api/znc/user', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleCurrentUserRequest(r)));
        app.get('/api/znc/user/presence', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleUserPresenceRequest(r)));

        app.get('/api/znc/friends', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendsRequest(r)));
        app.get('/api/znc/friends/favourites', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFavouriteFriendsRequest(r)));
        app.get('/api/znc/friends/presence', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendsPresenceRequest(r)));
        app.get('/api/znc/friends/favourites/presence', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFavouriteFriendsPresenceRequest(r)));

        app.get('/api/znc/friend/:nsaid', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendRequest(r, r.req.params.nsaid)));
        app.post('/api/znc/friend/:nsaid', bodyParser.json(),
            this.createProxyRequestHandler(r => this.handleUpdateFriendRequest(r, r.req.params.nsaid), true));
        app.get('/api/znc/friend/:nsaid/presence', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendPresenceRequest(r, r.req.params.nsaid)));

        app.get('/api/znc/webservices', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleWebServicesRequest(r)));
        app.get('/api/znc/webservice/:id/token',
            this.createProxyRequestHandler(r => this.handleWebServiceTokenRequest(r, r.req.params.id), true));
        app.get('/api/znc/activeevent', this.authTokenMiddleware, this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleActiveEventRequest(r)));

        app.get('/api/znc/event/:id',
            this.createProxyRequestHandler(r => this.handleEventRequest(r, r.req.params.id), true));
        app.get('/api/znc/user/:id',
            this.createProxyRequestHandler(r => this.handleUserRequest(r, r.req.params.id), true));

        app.get('/api/znc/friendcode/:friendcode', this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendCodeRequest(r, r.req.params.friendcode), true));
        app.get('/api/znc/friendcode', this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handleFriendCodeUrlRequest(r), true));

        app.get('/api/znc/presence/events', this.localAuthMiddleware,
            this.createProxyRequestHandler(r => this.handlePresenceEventStreamRequest(r), true));
    }

    protected createProxyRequestHandler(callback: (data: RequestDataWithUser) => Promise<{} | void>, auth: true): RequestHandler
    protected createProxyRequestHandler(callback: (data: RequestData) => Promise<{} | void>, auth?: boolean): RequestHandler
    protected createProxyRequestHandler(callback: (data: RequestDataWithUser) => Promise<{} | void>, auth = false) {
        return async (req: Request, res: Response) => {
            try {
                const user = req.coralUser ?? auth ? await this.getCoralUser(req) : undefined;

                const result = await callback.call(null, {
                    req, res,
                    user: user!,
                    policy: req.proxyAuthPolicy,
                    token: req.proxyAuthPolicyToken,
                });

                if (result) this.sendJsonResponse(res, result);
                else res.end();
            } catch (err) {
                if (err instanceof ResponseError) {
                    err.sendResponse(req, res);
                } else {
                    this.sendJsonResponse(res, {
                        error: err,
                        error_message: (err as Error).message,
                    }, 500);
                }
            }
        };
    }

    protected async _cache<T>(
        id: string, callback: () => Promise<T>,
        promises: Map<string, Promise<[number, T]>>,
        cache: Map<string, [number, T]>,
        update_interval = this.update_interval,
    ) {
        const data = cache.get(id);

        if (data && ((data[0] + update_interval) > Date.now())) {
            debug('Using cached data for %s', id);
            return data;
        }

        debug('Updating data for %s', id);

        return this._update(id, () =>
            callback.call(null)
                .then(result => [Date.now(), result] as const), promises, cache)
    }

    protected _update<T>(
        id: string, callback: () => Promise<T>,
        promises: Map<string, Promise<T>>,
        cache: Map<string, T>,
    ) {
        const promise = promises.get(id) ?? callback.call(null).then(result => {
            cache.set(id, result);
            return result;
        }).finally(() => {
            promises.delete(id);
        });
        promises.set(id, promise);
        return promise;
    }

    private localAuthMiddleware = this.createApiMiddleware(async (req, res) => {
        if (this.require_token || !req.query.user) return;

        const token = await this.storage.getItem('NintendoAccountToken.' + req.query.user);
        if (!token) return;

        req.headers['authorization'] = 'na ' + token;
    });

    private authTokenMiddleware = this.createApiMiddleware(async (req, res) => {
        if (req.headers['authorization']?.startsWith('Bearer ')) {
            const token = req.headers['authorization'].substr(7);

            const auth: AuthToken | undefined = await this.storage.getItem('ZncProxyAuthPolicy.' + token);
            if (!auth) return;

            req.proxyAuthPolicy = auth.policy;
            req.proxyAuthPolicyUser = auth.user;
            req.proxyAuthPolicyToken = token;
        } else if (req.query.token) {
            const auth: AuthToken | undefined = await this.storage.getItem('ZncProxyAuthPolicy.' + req.query.token);
            if (!auth) return;

            req.proxyAuthPolicy = auth.policy;
            req.proxyAuthPolicyUser = auth.user;
            req.proxyAuthPolicyToken = '' + req.query.token;
        }
    });

    private coral_auth_promise = new Map</** session token */ string, Promise<CoralUser>>();
    private coral_auth_timeout = new Map</** session token */ string, NodeJS.Timeout>();

    async getCoralUser(req: Request) {
        let na_session_token: string;
        if (req.proxyAuthPolicyUser) {
            const na_token = await this.storage.getItem('NintendoAccountToken.' + req.proxyAuthPolicyUser);
            if (!na_token) throw new Error('Nintendo Account for this token must reauthenticate');
            na_session_token = na_token;
        } else {
            const auth = req.headers['authorization'];
            if (!auth || !auth.startsWith('na ')) throw new Error('Requires Nintendo Account authentication');
            na_session_token = auth.substr(3);
        }

        let user_naid: string | null = null;

        const promise = this.coral_auth_promise.get(na_session_token) ?? (async () => {
            const user = await this.users.get(na_session_token);

            const users = new Set(await this.storage.getItem('NintendoAccountIds') ?? []);
            if (!users.has(user.data.user.id)) {
                users.add(user.data.user.id);
                await this.storage.setItem('NintendoAccountIds', [...users]);
            }

            user_naid = user.data.user.id;

            return user;
        })().catch(err => {
            // Keep the resolved promise when successful instead of calling users.get again
            this.coral_auth_promise.delete(na_session_token);
            clearTimeout(this.coral_auth_timeout.get(na_session_token));
            this.coral_auth_timeout.delete(na_session_token);
            throw err;
        });
        this.coral_auth_promise.set(na_session_token, promise);

        this.resetAuthTimeout(na_session_token, () => user_naid);

        return promise;
    }

    protected resetAuthTimeout(na_session_token: string, debug_get_naid?: () => string | null) {
        // Remove the authenticated CoralApi 30 minutes after last use
        clearTimeout(this.coral_auth_timeout.get(na_session_token));
        this.coral_auth_timeout.set(na_session_token, setTimeout(() => {
            debug('Removing old CoralApi instance', debug_get_naid?.call(null));
            this.coral_auth_promise.delete(na_session_token);
            this.coral_auth_timeout.delete(na_session_token);
            this.users.remove(na_session_token);
        }, 30 * 60 * 1000).unref());
    }

    async handleAuthRequest({user}: RequestDataWithUser) {
        return user.data;
    }

    async handleTokenRequest({policy, token}: RequestData) {
        if (!token) {
            throw new ResponseError(403, 'no_policy');
        }

        return policy;
    }

    async handleDeleteTokenRequest({req, res, token}: RequestData) {
        if (!token) {
            throw new ResponseError(403, 'no_policy');
        }

        await this.storage.removeItem('ZncProxyAuthPolicy.' + token);

        const tokens = new Set(await this.storage.getItem('ZncProxyAuthPolicies.' + req.proxyAuthPolicyUser) ?? []);
        tokens.delete(token);
        await this.storage.setItem('ZncProxyAuthPolicies.' + req.proxyAuthPolicyUser, [...tokens]);

        res.statusCode = 204;
    }

    async handleTokensRequest({user}: RequestDataWithUser) {
        const token_ids: string[] | undefined = await this.storage.getItem('ZncProxyAuthPolicies.' + user.data.user.id);
        const tokens = (await Promise.all(token_ids?.map(async id => {
            const auth: AuthToken | undefined = await this.storage.getItem('ZncProxyAuthPolicy.' + id);
            if (!auth) return;
            return {
                token: id,
                user: auth.user,
                policy: auth.policy,
                created_at: auth.created_at,
            };
        }) ?? [])).filter(p => p);

        return {tokens};
    }

    async handleCreateTokenRequest({req, user}: RequestDataWithUser) {
        const token = uuidgen();
        const auth: AuthToken = {
            user: user.data.user.id,
            policy: req.body.policy,
            created_at: Math.floor(Date.now() / 1000),
        };

        await this.storage.setItem('ZncProxyAuthPolicy.' + token, auth);

        const tokens = new Set(await this.storage.getItem('ZncProxyAuthPolicies.' + user.data.user.id) ?? []);
        tokens.add(token);
        await this.storage.setItem('ZncProxyAuthPolicies.' + user.data.user.id, [...tokens]);

        return {
            token,
            ...auth,
        };
    }

    //
    // Announcements
    // This is cached for all users.
    //

    async handleAnnouncementsRequest({req, policy}: RequestData) {
        if (policy && !policy.announcements) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const announcements: Announcement[] = user.announcements.result;
        return {announcements};
    }

    //
    // Nintendo Switch user data
    //

    private user_data_promise = new Map</** NA ID */ string, Promise<[number, CurrentUser]>>();
    private cached_userdata = new Map</** NA ID */ string, [number, CurrentUser]>();

    async getUserData(id: string, coral: CoralApi) {
        return this._cache(id, () => coral.getCurrentUser(),
            this.user_data_promise, this.cached_userdata);
    }

    async handleCurrentUserRequest({req, res, policy}: RequestData) {
        if (policy && !policy.current_user) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const [updated, current_user] = await this.getUserData(user.data.user.id, user.nso);

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return {user: current_user, updated};
    }

    async handleUserPresenceRequest({req, policy}: RequestData) {
        if (policy && !policy.current_user_presence) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const [updated, current_user] = await this.getUserData(user.data.user.id, user.nso);

        return current_user.presence;
    }

    //
    // Nintendo Switch friends, NSO app web services, events
    //

    async handleFriendsRequest({req, res, policy}: RequestData) {
        if (policy && !policy.list_friends) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));

        return {
            friends: policy?.friends ?
                friends.filter(f => policy.friends!.includes(f.nsaId)) : friends,
            updated,
        };
    }

    async handleFavouriteFriendsRequest({req, res, policy}: RequestData) {
        if (policy && !policy.list_friends) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));

        return {
            friends: friends.filter(f => {
                if (policy?.friends && !policy.friends.includes(f.nsaId)) return false;

                return f.isFavoriteFriend;
            }),
            updated,
        };
    }

    async handleFriendsPresenceRequest({req, res, policy}: RequestData) {
        if (policy && !policy.list_friends_presence) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;
        const presence: Record<string, Presence> = {};

        for (const friend of friends) {
            if (policy) {
                if (policy.friends_presence && !policy.friends_presence.includes(friend.nsaId)) continue;
                if (policy.friends && !policy.friends_presence && !policy.friends.includes(friend.nsaId)) continue;
            }

            presence[friend.nsaId] = friend.presence;
        }

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return presence;
    }

    async handleFavouriteFriendsPresenceRequest({req, res, policy}: RequestData) {
        if (policy && !policy.list_friends_presence) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;
        const presence: Record<string, Presence> = {};

        for (const friend of friends) {
            if (policy) {
                if (policy.friends_presence && !policy.friends_presence.includes(friend.nsaId)) continue;
                if (policy.friends && !policy.friends_presence && !policy.friends.includes(friend.nsaId)) continue;
            }

            if (!friend.isFavoriteFriend) continue;

            presence[friend.nsaId] = friend.presence;
        }

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return presence;
    }

    async handleFriendRequest({req, res, policy}: RequestData, nsaid: string) {
        if (policy && !policy.friend) {
            throw new ResponseError(403, 'token_unauthorised');
        }
        if (policy?.friends && !policy.friends.includes(nsaid)) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;
        const friend = friends.find(f => f.nsaId === nsaid);

        if (!friend) {
            throw new ResponseError(404, 'not_found', 'The user is not friends with the authenticated user.');
        }

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return {friend, updated};
    }

    async handleUpdateFriendRequest({req, res, user}: RequestDataWithUser, nsaid: string) {
        const friends = await user.getFriends();
        const updated = user.updated.friends;
        const friend = friends.find(f => f.nsaId === nsaid);

        if (!friend) {
            throw new ResponseError(404, 'not_found', 'The user is not friends with the authenticated user.');
        }

        if ('isFavoriteFriend' in req.body &&
            req.body.isFavoriteFriend !== true &&
            req.body.isFavoriteFriend !== false
        ) {
            throw new ResponseError(400, 'invalid_request', 'Invalid value for isFavoriteFriend.');
        }

        if ('isFavoriteFriend' in req.body) {
            if (friend.isFavoriteFriend !== req.body.isFavoriteFriend) {
                if (req.body.isFavoriteFriend) await user.nso.addFavouriteFriend(friend.nsaId);
                if (!req.body.isFavoriteFriend) await user.nso.removeFavouriteFriend(friend.nsaId);
            } else {
                // No change
            }
        }

        res.statusCode = 204;
    }

    async handleFriendPresenceRequest({req, res, policy}: RequestData, nsaid: string) {
        if (policy && !policy.friend_presence) {
            throw new ResponseError(403, 'token_unauthorised');
        }
        if (!(policy?.friends_presence?.includes(nsaid) ?? policy?.friends?.includes(nsaid) ?? true)) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const friends = await user.getFriends();
        const updated = user.updated.friends;
        const friend = friends.find(f => f.nsaId === nsaid);

        if (!friend) {
            throw new ResponseError(404, 'not_found', 'The user is not friends with the authenticated user.');
        }

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return friend.presence;
    }

    async handleWebServicesRequest({req, res, policy}: RequestData) {
        if (policy && !policy.webservices) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const [friends, webservices, activeevent] = await Promise.all([
            user.getFriends(),
            user.getWebServices(),
            user.getActiveEvent(),
        ]);
        const updated = user.updated.webservices;

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return {webservices, updated};
    }

    async handleWebServiceTokenRequest({user}: RequestDataWithUser, id: string) {
        const token = await user.nso.getWebServiceToken(parseInt(id));

        return {token};
    }

    async handleActiveEventRequest({req, res, policy}: RequestData) {
        if (policy && !policy.activeevent) {
            throw new ResponseError(403, 'token_unauthorised');
        }

        const user = await this.getCoralUser(req);

        const [friends, webservices, activeevent] = await Promise.all([
            user.getFriends(),
            user.getWebServices(),
            user.getActiveEvent(),
        ]);
        const updated = user.updated.webservices;

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));
        return {activeevent, updated};
    }

    async handleEventRequest({user}: RequestDataWithUser, id: string) {
        const event = await user.nso.getEvent(parseInt(id));

        return {event};
    }

    async handleUserRequest({user}: RequestDataWithUser, id: string) {
        if (!id.match(/^[0-9]{16}$/)) {
            throw new ResponseError(404, 'invalid_request', 'Invalid user ID');
        }

        const coral_user = await user.nso.getUser(parseInt(id));

        return {user: coral_user};
    }

    //
    // Friend codes
    //
    // This is cached for all users.
    //

    private friendcode_data_promise = new Map</** NA ID */ string, Map</** FC ID */ string,
        Promise<[number, [FriendCodeUser | null, /** NA ID */ string]]>>>();
    private cached_friendcode_data = new Map</** FC ID */ string,
        [number, [FriendCodeUser | null, /** NA ID */ string]]>();

    async getFriendCodeUser(id: string, coral: CoralApi, friendcode: string) {
        if (!FRIEND_CODE.test(friendcode)) {
            throw new ResponseError(400, 'invalid_request', 'Invalid friend code');
        }

        const promises = this.friendcode_data_promise.get(id) ??
            new Map<string, Promise<[number, [FriendCodeUser | null, string]]>>();
        this.friendcode_data_promise.set(id, promises);

        try {
            return await this._cache(friendcode, async (): Promise<[FriendCodeUser | null, string]> => {
                try {
                    const user = await coral.getUserByFriendCode(friendcode);
                    return [user, id];
                } catch (err) {
                    if (err instanceof ErrorResponse && err.data?.status === CoralStatus.RESOURCE_NOT_FOUND) {
                        // A user with this friend code doesn't exist
                        // This should be cached
                        return [null, id];
                    }

                    throw err;
                }
            }, promises, this.cached_friendcode_data);
        } finally {
            if (!promises.size) this.friendcode_data_promise.delete(id);
        }
    }

    async handleFriendCodeRequest({res, user}: RequestDataWithUser, friendcode: string) {
        const [updated, [friend_code_user, lookup_auth_user_id]] =
            await this.getFriendCodeUser(user.data.user.id, user.nso, friendcode);

        res.setHeader('Cache-Control', 'immutable, max-age=' + cacheMaxAge(updated, this.friendcode_update_interval));

        if (!friend_code_user) {
            throw new ResponseError(404, 'not_found', 'A user with this friend code was not found');
        }

        return {user: friend_code_user, updated};
    }

    private user_friendcodeurl_promise = new Map</** NA ID */ string, Promise<[number, FriendCodeUrl]>>();
    private cached_friendcodeurl = new Map</** NA ID */ string, [number, FriendCodeUrl]>();

    getFriendCodeUrl(id: string, coral: CoralApi) {
        return this._cache(id, () => coral.getFriendCodeUrl(),
            this.user_friendcodeurl_promise, this.cached_friendcodeurl);
    }

    async handleFriendCodeUrlRequest({res, user}: RequestDataWithUser) {
        const [updated, friendcodeurl] = await this.getFriendCodeUrl(user.data.user.id, user.nso);

        res.setHeader('Cache-Control', 'private, immutable, max-age=' + cacheMaxAge(updated, this.update_interval));

        return {
            friendcode: friendcodeurl,
            updated,
        };
    }

    //
    // Event stream
    //

    async handlePresenceEventStreamRequest({req, res, user}: RequestDataWithUser) {
        const na_session_token = req.headers['authorization']!.substr(3);
        const i = new ZncNotifications(this.storage, na_session_token, user.nso, user.data, user);

        i.user_notifications = false;
        i.friend_notifications = true;
        i.update_interval = this.update_interval / 1000;

        const stream = new EventStreamResponse(req, res);
        i.notifications = new EventStreamNotificationManager(stream);

        try {
            await i.loop(true);

            while (!res.closed) {
                await i.loop();

                this.resetAuthTimeout(na_session_token, () => user.data.user.id);
            }
        } catch (err) {
            stream.sendEvent('error', {
                error: (err as Error).name,
                error_message: (err as Error).message,
            });
        }
    }
}

function cacheMaxAge(updated_timestamp_ms: number, update_interval_ms: number) {
    return Math.floor(((updated_timestamp_ms + update_interval_ms) - Date.now()) / 1000);
}

class EventStreamNotificationManager extends NotificationManager {
    constructor(readonly stream: EventStreamResponse) {
        super();
    }

    onPresenceUpdated(
        friend: CurrentUser | Friend, prev?: CurrentUser | Friend, type?: PresenceEvent,
        naid?: string, ir?: boolean
    ) {
        this.stream.sendEvent(ZncPresenceEventStreamEvent.PRESENCE_UPDATED, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        this.stream.sendEvent(ZncPresenceEventStreamEvent.FRIEND_ONLINE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        this.stream.sendEvent(ZncPresenceEventStreamEvent.FRIEND_OFFLINE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        this.stream.sendEvent(ZncPresenceEventStreamEvent.FRIEND_TITLE_CHANGE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        this.stream.sendEvent(ZncPresenceEventStreamEvent.FRIEND_TITLE_STATECHANGE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }
}
