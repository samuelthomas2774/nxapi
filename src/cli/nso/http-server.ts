import createDebug from 'debug';
import express from 'express';
import * as net from 'net';
import persist from 'node-persist';
import { ActiveEvent, Announcement, CurrentUser, Friend, Presence, WebService } from '../../api/znc-types.js';
import ZncApi from '../../api/znc.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, SavedToken, YargsArguments } from '../../util.js';
import { ZncNotifications } from './notify.js';

declare global {
    namespace Express {
        interface Request {
            znc?: ZncApi;
            zncAuth?: SavedToken;
        }
    }
}

const debug = createDebug('cli:http-server');

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
    const updateInterval = argv.updateInterval * 1000;

    const storage = await initStorage(argv.dataPath);

    const app = express();

    const localAuth: express.RequestHandler = async (req, res, next) => {
        if (argv.requireToken || !req.query.user) return next();

        const token = await storage.getItem('NintendoAccountToken.' + req.query.user);
        if (!token) return next();

        req.headers['authorization'] = 'na ' + token;

        next();
    };

    const nsoAuth: express.RequestHandler = async (req, res, next) => {
        try {
            const auth = req.headers['authorization'];
            if (!auth || !auth.startsWith('na ')) throw new Error('Requires Nintendo Account authentication');
            const nintendoAccountSessionToken = auth.substr(3);

            const {nso, data} = await getToken(storage, nintendoAccountSessionToken, argv.zncProxyUrl);

            req.znc = nso;
            req.zncAuth = data;

            const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
            users.add(data.user.id);
            await storage.setItem('NintendoAccountIds', [...users]);

            next();
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    };

    app.get('/api/znc/auth', nsoAuth, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(req.zncAuth));
    });

    //
    // Announcements
    // This is cached for all users.
    //

    let cached_announcements: Announcement[] | null = null;
    app.get('/api/znc/announcements', localAuth, nsoAuth, async (req, res) => {
        if (cached_announcements) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                announcements: cached_announcements,
            }));
            return;
        }

        try {
            const announcements = await req.znc!.getAnnouncements();
            cached_announcements = announcements.result;

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                announcements: announcements.result,
            }));
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    });

    //
    // Nintendo Switch friends, NSO app web services, events
    //

    const cached_appdata = new Map<string, [Friend[], WebService[], ActiveEvent, number]>();

    const getAppData: express.RequestHandler = async (req, res, next) => {
        const cache = cached_appdata.get(req.zncAuth!.user.id);

        if (cache && ((cache[3] + updateInterval) > Date.now())) {
            debug('Using cached app data for %s', req.zncAuth!.user.id);
            next();
            return;
        }

        try {
            const friends = await req.znc!.getFriendList();
            const webservices = await req.znc!.getWebServices();
            const activeevent = await req.znc!.getActiveEvent();

            cached_appdata.set(req.zncAuth!.user.id, [
                friends.result.friends, webservices.result, activeevent.result, Date.now(),
            ]);

            next();
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    };

    app.get('/api/znc/friends', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({friends, updated}));
    });

    app.get('/api/znc/friends/presence', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;
        const presence: Record<string, Presence> = {};

        for (const friend of friends) {
            presence[friend.nsaId] = friend.presence;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(presence));
    });

    app.get('/api/znc/friend/:nsid', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;
        const friend = friends.find(f => f.nsaId === req.params.nsid);

        if (!friend) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'not_found',
                error_message: 'The user is not friends with the authenticated user.',
            }));
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({friend, updated}));
    });

    app.get('/api/znc/friend/:nsid/presence', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;
        const friend = friends.find(f => f.nsaId === req.params.nsid);

        if (!friend) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'not_found',
                error_message: 'The user is not friends with the authenticated user.',
            }));
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(friend.presence));
    });

    app.get('/api/znc/webservices', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({webservices, updated}));
    });

    app.get('/api/znc/webservice/:id/token', nsoAuth, async (req, res) => {
        try {
            const response = await req.znc!.getWebServiceToken(req.params.id, req.zncAuth!.credential.accessToken);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                token: response.result,
            }));
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    });

    app.get('/api/znc/activeevent', localAuth, nsoAuth, getAppData, async (req, res) => {
        const [friends, webservices, activeevent, updated] = cached_appdata.get(req.zncAuth!.user.id)!;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({activeevent, updated}));
    });

    //
    // Nintendo Switch user data
    //

    const cached_userdata = new Map<string, [CurrentUser, number]>();

    const getUserData: express.RequestHandler = async (req, res, next) => {
        const cache = cached_userdata.get(req.zncAuth!.user.id);

        if (cache && ((cache[1] + updateInterval) > Date.now())) {
            debug('Using cached user data for %s', req.zncAuth!.user.id);
            next();
            return;
        }

        try {
            const user = await req.znc!.getCurrentUser();
            cached_userdata.set(req.zncAuth!.user.id, [user.result, Date.now()]);

            next();
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    };

    app.get('/api/znc/user', localAuth, nsoAuth, getUserData, async (req, res) => {
        const [user, updated] = cached_userdata.get(req.zncAuth!.user.id)!;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({user, updated}));
    });

    app.get('/api/znc/user/presence', localAuth, nsoAuth, getUserData, async (req, res) => {
        const [user, updated] = cached_userdata.get(req.zncAuth!.user.id)!;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(user.presence));
    });

    //
    // Event stream
    //

    app.get('/api/znc/presence/events', localAuth, nsoAuth, async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/event-stream');

        const nintendoAccountSessionToken = req.headers['authorization']!.substr(3);
        const i = new ZncPresenceEventStream(
            argv as any, storage, nintendoAccountSessionToken, req.znc!, req.zncAuth!,
            req, res,
            true, true,
        );

        await i.init();

        while (true) {
            await i.loop();
        }
    });

    for (const address of argv.listen) {
        const match = address.match(/^(?:((?:\d+\.){3}\d+)|\[(.*)\]):(\d+)$/);
        if (!match || !net.isIP(match[1] || match[2])) throw new Error('Not a valid address/port');

        const server = app.listen(parseInt(match[3]), match[1] || match[2]);
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log('Listening on %s, port %d', address.address, address.port);
        });
    }
}

export enum ZncPresenceEventStreamEvent {
    FRIEND_ONLINE = '0',
    FRIEND_OFFLINE = '1',
    FRIEND_TITLE_CHANGE = '2',
    FRIEND_TITLE_STATECHANGE = '3',
}

class ZncPresenceEventStream extends ZncNotifications {
    constructor(
        argv: ArgumentsCamelCase<Arguments>,
        storage: persist.LocalStorage,
        token: string,
        nso: ZncApi,
        data: Omit<SavedToken, 'expires_at'>,
        public req: express.Request,
        public res: express.Response,
        user: boolean,
        friend: boolean,
    ) {
        super({
            ...argv,
            user: undefined,
            token: undefined,
            'user-notifications': user,
            userNotifications: user,
            'friend-notifications': friend,
            friendNotifications: friend,
        }, storage, token, nso, data);
    }

    sendEvent(event: string | null, ...data: unknown[]) {
        if (event) this.res.write('event: ' + event + '\n');
        for (const d of data) this.res.write('data: ' + JSON.stringify(d) + '\n');
        this.res.write('\n');
    }

    onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        this.sendEvent(ZncPresenceEventStreamEvent.FRIEND_ONLINE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        this.sendEvent(ZncPresenceEventStreamEvent.FRIEND_OFFLINE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        this.sendEvent(ZncPresenceEventStreamEvent.FRIEND_TITLE_CHANGE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }

    onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        this.sendEvent(ZncPresenceEventStreamEvent.FRIEND_TITLE_STATECHANGE, {
            id: friend.nsaId, presence: friend.presence, prev: prev?.presence,
        });
    }
}
