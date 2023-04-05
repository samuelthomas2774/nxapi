import * as net from 'node:net';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import createDebug from 'debug';
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import * as persist from 'node-persist';
import mkdirp from 'mkdirp';
import { BankaraMatchMode, BankaraMatchSetting_schedule, CoopSetting_schedule, DetailFestRecordDetailResult, DetailVotingStatusResult, FestMatchSetting_schedule, FestRecordResult, FestState, FestTeam_schedule, FestTeam_votingStatus, FestVoteState, Fest_schedule, FriendListResult, FriendOnlineState, Friend_friendList, GraphQLSuccessResponse, KnownRequestId, LeagueMatchSetting_schedule, RegularMatchSetting_schedule, StageScheduleResult, VsMode, XMatchSetting_schedule } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';
import { initStorage } from '../util/storage.js';
import { addCliFeatureUserAgent, getUserAgent } from '../util/useragent.js';
import { parseListenAddress } from '../util/net.js';
import { product, version } from '../util/product.js';
import Users, { CoralUser } from '../common/users.js';
import { Friend } from '../api/coral-types.js';
import { getBulletToken, SavedBulletToken } from '../common/auth/splatnet3.js';
import SplatNet3Api, { PersistedQueryResult, RequestIdSymbol } from '../api/splatnet3.js';
import { ErrorResponse, ResponseSymbol } from '../api/util.js';
import { EventStreamResponse, HttpServer, ResponseError } from './util/http-server.js';
import { getTitleIdFromEcUrl } from '../util/misc.js';
import StageScheduleQuery_730cd98 from 'splatnet3-types/graphql/730cd98e84f1030d3e9ac86b6f1aae13';

const debug = createDebug('cli:presence-server');
const debugSplatnet3Proxy = createDebug('cli:presence-server:splatnet3-proxy');

interface AllUsersResult extends Friend {
    title: TitleResult | null;
    splatoon3?: Friend_friendList | null;
    splatoon3_fest_team?: (FestTeam_schedule & FestTeam_votingStatus) | null;
}
interface PresenceResponse {
    friend: Friend;
    title: TitleResult | null;
    splatoon3?: Friend_friendList | null;
    splatoon3_fest_team?: (FestTeam_schedule & FestTeam_votingStatus) | null;
    splatoon3_vs_setting?:
        RegularMatchSetting_schedule | BankaraMatchSetting_schedule | FestMatchSetting_schedule |
        LeagueMatchSetting_schedule | XMatchSetting_schedule | null;
    splatoon3_coop_setting?: CoopSetting_schedule | null;
    splatoon3_fest?: Fest_schedule | null;
}
interface TitleResult {
    id: string;
    name: string;
    image_url: string;
    url: string;
    since: string;
}

interface FestVotingStatusRecord {
    result: Exclude<DetailVotingStatusResult['fest'], null>;
    query: KnownRequestId;
    app_version: string;
    be_version: string | null;

    friends: {
        result: FriendListResult['friends'];
        query: KnownRequestId;
        be_version: string | null;
    };

    fest: StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null;
}

export const command = 'presence-server';
export const desc = 'Starts a HTTP server to fetch presence data from Coral and SplatNet 3';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
        array: true,
        ...process.env.NXAPI_PRESENCE_SERVER_USER ? {
            default: process.env.NXAPI_PRESENCE_SERVER_USER.split(','),
        } : {},
    }).option('splatnet3', {
        describe: 'Enable SplatNet 3 presence',
        type: 'boolean',
        default: false,
    }).option('allow-all-users', {
        describe: 'Enable returning all users',
        type: 'boolean',
        default: false,
    }).option('splatnet3-proxy', {
        describe: 'Enable SplatNet 3 proxy',
        type: 'boolean',
        default: false,
    }).option('splatnet3-proxy-url', {
        describe: 'SplatNet 3 proxy URL',
        type: 'string',
        default: process.env.NXAPI_PRESENCE_SERVER_SPLATNET3_PROXY_URL,
    }).option('splatnet3-fest-votes', {
        describe: 'Record Splatoon 3 fest vote history',
        type: 'boolean',
        default: false,
    }).option('splatnet3-record-fest-votes', {
        describe: 'Record Splatoon 3 fest vote history',
        type: 'boolean',
        default: false,
    }).option('update-interval', {
        describe: 'Max. update interval in seconds',
        type: 'number',
        default: 30,
    }).option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

const ResourceUrlMapSymbol = Symbol('ResourceUrls');

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    addCliFeatureUserAgent('presence-server');

    const storage = await initStorage(argv.dataPath);

    const user_naid: string | undefined = !argv.user ? await storage.getItem('SelectedUser') : undefined;
    const user_naids = argv.user ?? (user_naid ? [user_naid] : []);

    debug('user', user_naids);

    if (!user_naids.length && !argv.splatnet3Proxy) {
        throw new Error('No user selected');
    }

    const coral_users = Users.coral(storage, argv.zncProxyUrl);

    const splatnet3_users = argv.splatnet3 ? new Users(async token => {
        return argv.splatnet3ProxyUrl ?
            SplatNet3ProxyUser.create(argv.splatnet3ProxyUrl, token) :
            SplatNet3ApiUser.create(storage, token, argv.zncProxyUrl);
    }) : null;

    const image_proxy_path = {
        baas: path.join(argv.dataPath, 'presence-server-resources', 'baas'),
        atum: path.join(argv.dataPath, 'presence-server-resources', 'atum'),
        splatnet3: path.join(argv.dataPath, 'presence-server-resources', 'splatnet3'),
    };

    const server = new Server(storage, coral_users, splatnet3_users, user_naids, image_proxy_path);

    server.allow_all_users = argv.allowAllUsers;
    server.enable_splatnet3_proxy = argv.splatnet3Proxy;
    server.record_fest_votes = argv.splatnet3FestVotes || argv.splatnet3RecordFestVotes ? {
        path: path.join(argv.dataPath, 'presence-server'),
        read: argv.splatnet3FestVotes,
        write: argv.splatnet3RecordFestVotes,
    } : null;
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

    if (argv.splatnet3RecordFestVotes) {
        const update_interval_fest_voting_status_record = 60 * 60 * 1000; // 60 minutes

        const recordFestVotes = async (is_force_early = false) => {
            const users = await Promise.all(user_naids.map(id => server.getSplatNet3User(id)));

            debug('Checking for new fest votes to record', is_force_early);

            let fest_ending: StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null = null;

            for (const user of users) {
                try {
                    const fest = await user.getCurrentFest();

                    if (is_force_early) user.updated.fest_vote_status = null;

                    // Fetching current fest vote data will record any new data
                    await user.getCurrentFestVotes();

                    if (fest && (!fest_ending ||
                        new Date(fest_ending.endTime).getTime() > new Date(fest.endTime).getTime()
                    )) {
                        fest_ending = fest;
                    }
                } catch (err) {
                    debug('Error fetching current fest voting status for recording');
                }
            }

            const time_until_fest_ends_ms = fest_ending ? new Date(fest_ending.endTime).getTime() - Date.now() : null;
            const update_interval = time_until_fest_ends_ms && time_until_fest_ends_ms > 60 * 1000 ?
                Math.min(time_until_fest_ends_ms - 60 * 1000, update_interval_fest_voting_status_record) :
                update_interval_fest_voting_status_record;

            setTimeout(() => recordFestVotes(update_interval !== update_interval_fest_voting_status_record),
                update_interval);
        };

        recordFestVotes();
    }
}

abstract class SplatNet3User {
    created_at = Date.now();
    expires_at = Infinity;

    record_fest_votes: {
        path: string;
        read: boolean;
        write: boolean;
    } | null = null;

    schedules: GraphQLSuccessResponse<StageScheduleResult> | null = null;
    fest_records: GraphQLSuccessResponse<FestRecordResult> | null = null;
    current_fest: StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null = null;
    fest_vote_status: GraphQLSuccessResponse<DetailVotingStatusResult> | null = null;

    promise = new Map<string, Promise<void>>();

    updated = {
        friends: Date.now(),
        schedules: null as number | null,
        fest_records: null as number | null,
        current_fest: null as number | null,
        fest_vote_status: null as number | null,
    };
    update_interval = 10 * 1000; // 10 seconds
    update_interval_schedules = 60 * 60 * 1000; // 60 minutes
    update_interval_fest_voting_status: number | null = null; // 10 seconds

    constructor(
        public friends: GraphQLSuccessResponse<FriendListResult>,
    ) {}

    protected async update(key: keyof SplatNet3User['updated'], callback: () => Promise<void>, ttl: number) {
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

    async getFriends(): Promise<Friend_friendList[]> {
        await this.update('friends', async () => {
            this.friends = await this.getFriendsData();
        }, this.update_interval);

        return this.friends.data.friends.nodes;
    }

    abstract getFriendsData(): Promise<GraphQLSuccessResponse<FriendListResult>>;

    async getSchedules(): Promise<StageScheduleResult> {
        let update_interval = this.update_interval_schedules;

        if (this.schedules && this.schedules.data.currentFest) {
            const tricolour_open = new Date(this.schedules.data.currentFest.midtermTime).getTime() <= Date.now();
            const should_refresh_fest = tricolour_open &&
                ![FestState.SECOND_HALF, FestState.CLOSED].includes(this.schedules.data.currentFest.state as FestState);

            if (should_refresh_fest) update_interval = this.update_interval;
        }

        await this.update('schedules', async () => {
            this.schedules = await this.getSchedulesData();
        }, update_interval);

        return this.schedules!.data;
    }

    abstract getSchedulesData(): Promise<GraphQLSuccessResponse<StageScheduleResult>>;

    async getCurrentFest(): Promise<StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null> {
        let update_interval = this.update_interval_schedules;

        if (this.schedules && this.schedules.data.currentFest) {
            const tricolour_open = new Date(this.schedules.data.currentFest.midtermTime).getTime() <= Date.now();
            const should_refresh_fest = tricolour_open &&
                ![FestState.SECOND_HALF, FestState.CLOSED].includes(this.schedules.data.currentFest.state as FestState);

            if (should_refresh_fest) update_interval = this.update_interval;
        }

        await this.update('current_fest', async () => {
            this.current_fest = await this.getCurrentFestData();
        }, update_interval);

        return this.current_fest;
    }

    abstract getCurrentFestData(): Promise<StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null>;

    async getCurrentFestVotes(): Promise<DetailVotingStatusResult['fest'] | null> {
        await this.update('fest_vote_status', async () => {
            const fest_vote_status = await this.getCurrentFestVotingStatusData();

            if (fest_vote_status) this.tryRecordFestVotes(fest_vote_status);

            this.fest_vote_status = fest_vote_status;
        }, this.update_interval_fest_voting_status ?? this.update_interval);

        return this.fest_vote_status?.data.fest ?? null;
    }

    abstract getCurrentFestVotingStatusData(): Promise<GraphQLSuccessResponse<DetailVotingStatusResult> | null>;

    async tryRecordFestVotes(fest_vote_status: GraphQLSuccessResponse<DetailVotingStatusResult>) {
        if (this.record_fest_votes?.write && fest_vote_status.data.fest &&
            JSON.stringify(fest_vote_status?.data) !== JSON.stringify(this.fest_vote_status?.data)
        ) {
            try {
                await this.recordFestVotes(fest_vote_status as PersistedQueryResult<DetailVotingStatusResult>);
            } catch (err) {
                debug('Error recording updated fest vote data', fest_vote_status.data.fest.id, err);
            }
        }
    }

    async recordFestVotes(fest_vote_status: PersistedQueryResult<DetailVotingStatusResult>) {
        throw new Error('Cannot record fest vote status when using SplatNet 3 API proxy');
    }
}

class SplatNet3ApiUser extends SplatNet3User {
    constructor(
        public splatnet: SplatNet3Api,
        public data: SavedBulletToken,
        public friends: GraphQLSuccessResponse<FriendListResult>,
    ) {
        super(friends);
    }

    async getFriendsData() {
        return this.splatnet.getFriendsRefetch();
    }

    async getSchedulesData() {
        return this.splatnet.getSchedules();
    }

    async getCurrentFestData() {
        const schedules = await this.getSchedules();

        if (schedules.currentFest) {
            return new Date(schedules.currentFest.endTime).getTime() <= Date.now() ? null : schedules.currentFest;
        }

        await this.update('fest_records', async () => {
            this.fest_records = await this.splatnet.getFestRecords();
        }, this.update_interval_schedules);

        const current_or_upcoming_fest = this.fest_records!.data.festRecords.nodes.find(fest =>
            new Date(fest.endTime).getTime() >= Date.now());
        if (!current_or_upcoming_fest) return null;

        const fest_detail = await this.getFestDetailData(current_or_upcoming_fest.id);

        return fest_detail.data.fest;
    }

    async getFestDetailData(id: string) {
        return this.current_fest?.id === id ?
            await this.splatnet.getFestDetailRefetch(id) :
            await this.splatnet.getFestDetail(id);
    }

    async getCurrentFestVotingStatusData() {
        const fest = await this.getCurrentFest();
        return !fest || new Date(fest.endTime).getTime() <= Date.now() ? null :
            await this.getFestVotingStatusData(fest.id);
    }

    async getFestVotingStatusData(id: string) {
        return this.fest_vote_status?.data.fest?.id === id ?
            await this.splatnet.getFestVotingStatusRefetch(id) :
            await this.splatnet.getFestVotingStatus(id);
    }

    async recordFestVotes(result: PersistedQueryResult<DetailVotingStatusResult>) {
        if (!result.data.fest) return;

        const id_str = Buffer.from(result.data.fest.id, 'base64').toString() || result.data.fest.id;
        const match = id_str.match(/^Fest-([A-Z]{2}):(([A-Z]+)-(\d+))$/);
        const id = match ? match[1] + '-' + match[2] : id_str;

        debug('Recording updated fest vote data', id);

        await this.getFriends();
        const friends = this.friends as PersistedQueryResult<FriendListResult>;

        const record: FestVotingStatusRecord = {
            result: result.data.fest,
            query: result[RequestIdSymbol],
            app_version: this.splatnet.version,
            be_version: result[ResponseSymbol].headers.get('x-be-version'),

            friends: {
                result: friends.data.friends,
                query: friends[RequestIdSymbol],
                be_version: friends[ResponseSymbol].headers.get('x-be-version'),
            },

            fest: await this.getCurrentFest(),
        };

        await mkdirp(path.join(this.record_fest_votes!.path, 'splatnet3-fest-votes-' + id));
        await fs.writeFile(path.join(this.record_fest_votes!.path, 'splatnet3-fest-votes-' + id, Date.now() + '.json'), JSON.stringify(record, null, 4) + '\n');
    }

    static async create(storage: persist.LocalStorage, token: string, znc_proxy_url?: string) {
        const {splatnet, data} = await getBulletToken(storage, token, znc_proxy_url, true);

        const friends = await splatnet.getFriends();

        splatnet.getCurrentFest().catch(err => {
            debug('Error in useCurrentFest request', err);
        });
        splatnet.getConfigureAnalytics().catch(err => {
            debug('Error in ConfigureAnalyticsQuery request', err);
        });

        return new SplatNet3ApiUser(splatnet, data, friends);
    }
}

class SplatNet3ProxyUser extends SplatNet3User {
    constructor(
        readonly url: string,
        private readonly token: string,
        public friends: GraphQLSuccessResponse<FriendListResult>,
    ) {
        super(friends);
    }

    async fetch(url: string) {
        return SplatNet3ProxyUser.fetch(this.url, url, this.token);
    }

    async getFriendsData() {
        return this.fetch('/friends');
    }

    async getSchedulesData() {
        return this.fetch('/schedules');
    }

    async getCurrentFestData() {
        return this.fetch('/fest/current');
    }

    async getCurrentFestVotingStatusData() {
        return this.fetch('/fest/current/voting-status');
    }

    static async fetch(base_url: string, url: string, token: string) {
        const response = await fetch(base_url + url, {
            method: 'GET',
            headers: {
                'User-Agent': getUserAgent(),
                'Authorization': 'na ' + token,
            },
        });

        debugSplatnet3Proxy('fetch %s %s, response %s', 'GET', url, response.status);

        if (response.status !== 200) {
            throw new ErrorResponse('[splatnet3] Non-200 status code', response, await response.text());
        }

        const data: any = await response.json();
        return data.result;
    }

    static async create(url: string, token: string) {
        const friends = await this.fetch(url, '/friends', token);

        return new SplatNet3ProxyUser(url, token, friends);
    }
}

class Server extends HttpServer {
    allow_all_users = false;
    enable_splatnet3_proxy = false;

    record_fest_votes: {
        path: string;
        read: boolean;
        write: boolean;
    } | null = null;

    readonly image_proxy_path_baas: string | null = null;
    readonly image_proxy_path_atum: string | null = null;
    readonly image_proxy_path_splatnet3: string | null = null;

    update_interval = 30 * 1000;
    /** Interval coral friends data should be updated if the requested user isn't friends with the authenticated user */
    update_interval_unknown_friends = 10 * 60 * 1000; // 10 minutes

    app: express.Express;

    titles = new Map</** NSA ID */ string, [TitleResult | null, /** updated */ number]>();
    readonly promise_image = new Map<string, Promise<string>>();

    constructor(
        readonly storage: persist.LocalStorage,
        readonly coral_users: Users<CoralUser>,
        readonly splatnet3_users: Users<SplatNet3User> | null,
        readonly user_ids: string[],
        image_proxy_path?: {baas?: string; atum?: string; splatnet3?: string;},
    ) {
        super();

        const app = this.app = express();

        app.use('/api/presence', (req, res, next) => {
            console.log('[%s] %s %s HTTP/%s from %s, port %d%s, %s',
                new Date(), req.method, req.url, req.httpVersion,
                req.socket.remoteAddress, req.socket.remotePort,
                req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
                req.headers['user-agent']);

            res.setHeader('Server', product + ' presence-server');
            res.setHeader('X-Server', product + ' presence-server');
            res.setHeader('X-Served-By', os.hostname());

            next();
        });

        app.get('/api/presence', this.createApiRequestHandler((req, res) =>
            this.handleAllUsersRequest(req, res)));
        app.get('/api/presence/:user', this.createApiRequestHandler((req, res) =>
            this.handlePresenceRequest(req, res, req.params.user)));
        app.get('/api/presence/:user/splatoon3-fest-votes', this.createApiRequestHandler((req, res) =>
            this.handleUserFestVotingStatusHistoryRequest(req, res, req.params.user)));
        app.get('/api/presence/:user/events', this.createApiRequestHandler((req, res) =>
            this.handlePresenceStreamRequest(req, res, req.params.user)));

        if (image_proxy_path?.baas) {
            this.image_proxy_path_baas = image_proxy_path.baas;
            app.use('/api/presence/resources/baas', express.static(this.image_proxy_path_baas, {redirect: false}));
        }
        if (image_proxy_path?.atum) {
            this.image_proxy_path_atum = image_proxy_path.atum;
            app.use('/api/presence/resources/atum', express.static(this.image_proxy_path_atum, {redirect: false}));
        }

        app.use('/api/splatnet3-presence', (req, res, next) => {
            console.log('[%s] [splatnet3 proxy] %s %s HTTP/%s from %s, port %d%s, %s',
                new Date(), req.method, req.url, req.httpVersion,
                req.socket.remoteAddress, req.socket.remotePort,
                req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
                req.headers['user-agent']);

            res.setHeader('Server', product + ' presence-server splatnet3-proxy');
            res.setHeader('X-Server', product + ' presence-server splatnet3-proxy');
            res.setHeader('X-Served-By', os.hostname());

            next();
        });

        app.get('/api/splatnet3-presence/friends', this.createApiRequestHandler((req, res) =>
            this.handleSplatNet3ProxyFriends(req, res)));
        app.get('/api/splatnet3-presence/schedules', this.createApiRequestHandler((req, res) =>
            this.handleSplatNet3ProxySchedules(req, res)));
        app.get('/api/splatnet3-presence/fest/current', this.createApiRequestHandler((req, res) =>
            this.handleSplatNet3ProxyCurrentFest(req, res)));
        app.get('/api/splatnet3-presence/fest/current/voting-status', this.createApiRequestHandler((req, res) =>
            this.handleSplatNet3ProxyCurrentFestVotingStatus(req, res)));

        app.use('/api/splatnet3', (req, res, next) => {
            console.log('[%s] [splatnet3] %s %s HTTP/%s from %s, port %d%s, %s',
                new Date(), req.method, req.url, req.httpVersion,
                req.socket.remoteAddress, req.socket.remotePort,
                req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
                req.headers['user-agent']);

            res.setHeader('Server', product + ' presence-server splatnet3-proxy');
            res.setHeader('X-Server', product + ' presence-server splatnet3-proxy');
            res.setHeader('X-Served-By', os.hostname());

            next();
        });

        if (image_proxy_path?.splatnet3) {
            this.image_proxy_path_splatnet3 = image_proxy_path.splatnet3;
            app.use('/api/splatnet3/resources', express.static(this.image_proxy_path_splatnet3, {redirect: false}));
        }
    }

    protected encodeJsonForResponse(data: unknown, space?: number) {
        return JSON.stringify(data, (key: string, value: unknown) => replacer(key, value, data), space);
    }

    async getCoralUser(naid: string) {
        const token = await this.storage.getItem('NintendoAccountToken.' + naid);
        const user = await this.coral_users.get(token);
        user.update_interval = this.update_interval;
        return user;
    }

    async getSplatNet3User(naid: string) {
        const token = await this.storage.getItem('NintendoAccountToken.' + naid);
        return this.getSplatNet3UserBySessionToken(token);
    }

    async getSplatNet3UserBySessionToken(token: string) {
        const user = await this.splatnet3_users!.get(token);
        user.record_fest_votes = this.record_fest_votes;
        user.update_interval = this.update_interval;
        return user;
    }

    async handleAllUsersRequest(req: Request, res: Response) {
        if (!this.allow_all_users) {
            throw new ResponseError(403, 'forbidden');
        }

        const include_splatnet3 = this.splatnet3_users && req.query['include-splatoon3'] === '1';

        const result: AllUsersResult[] = [];

        const users = await Promise.all(this.user_ids.map(id => this.getCoralUser(id)));

        for (const user of users) {
            const friends = await user.getFriends();

            for (const friend of friends) {
                const index = result.findIndex(f => f.nsaId === friend.nsaId);
                if (index >= 0) {
                    const match = result[index];

                    if (match.presence.updatedAt && !friend.presence.updatedAt) continue;
                    if (match.presence.updatedAt >= friend.presence.updatedAt) continue;

                    result.splice(index, 1);
                }

                const title = this.getTitleResult(friend, user.updated.friends, req);

                result.push(Object.assign({}, friend, {
                    title,
                    ...include_splatnet3 ? {splatoon3: null} : {},
                }));
            }
        }

        if (this.splatnet3_users && include_splatnet3) {
            const users = await Promise.all(this.user_ids.map(id => this.getSplatNet3User(id)));

            for (const user of users) {
                const friends = await user.getFriends();
                const fest_vote_status = await user.getCurrentFestVotes();

                for (const friend of friends) {
                    const friend_nsaid = Buffer.from(friend.id, 'base64').toString()
                        .replace(/^Friend-([0-9a-f]{16})$/, '$1');
                    const match = result.find(f => f.nsaId === friend_nsaid);
                    if (!match) continue;

                    match.splatoon3 = friend;

                    if (fest_vote_status) {
                        for (const team of fest_vote_status.teams) {
                            if (!team.votes || !team.preVotes) continue;

                            for (const player of team.votes.nodes) {
                                if (player.userIcon.url !== friend.userIcon.url) continue;

                                match.splatoon3_fest_team = {
                                    ...createFestVoteTeam(team, FestVoteState.VOTED),
                                    myVoteState: FestVoteState.VOTED,
                                };
                                break;
                            }

                            if (match.splatoon3_fest_team) break;
                            
                            for (const player of team.preVotes.nodes) {
                                if (player.userIcon.url !== friend.userIcon.url) continue;

                                match.splatoon3_fest_team = {
                                    ...createFestVoteTeam(team, FestVoteState.PRE_VOTED),
                                    myVoteState: FestVoteState.PRE_VOTED,
                                };
                                break;
                            }
    
                            if (match.splatoon3_fest_team) break;
                        }

                        if (!match.splatoon3_fest_team && fest_vote_status.undecidedVotes) {
                            match.splatoon3_fest_team = null;
                        }
                    }
                }
            }
        }

        result.sort((a, b) => b.presence.updatedAt - a.presence.updatedAt);

        const images = await this.downloadImages(result, this.getResourceBaseUrls(req));

        return {result, [ResourceUrlMapSymbol]: images};
    }

    async handlePresenceRequest(req: Request, res: Response | null, presence_user_nsaid: string, is_stream = false) {
        if (res && !is_stream) {
            const req_url = new URL(req.url, 'http://localhost');
            const stream_url = new URL('/api/presence/' + encodeURIComponent(presence_user_nsaid) + '/events', req_url);
            res.setHeader('Link', '<' + encodeURI(stream_url.pathname + req_url.search) +
                '>; rel="alternate"; type="text/event-stream"');
        }

        res?.setHeader('Access-Control-Allow-Origin', '*');

        const include_splatnet3 = this.splatnet3_users && req.query['include-splatoon3'] === '1';

        let match: [CoralUser, Friend, string] | null = null;

        for (const user_naid of this.user_ids) {
            const token = await this.storage.getItem('NintendoAccountToken.' + user_naid);
            const user = await this.coral_users.get(token);
            user.update_interval = this.update_interval;

            const has_friend = user.friends.result.friends.find(f => f.nsaId === presence_user_nsaid);
            const skip_update_unknown_friends =
                (user.updated.friends + this.update_interval_unknown_friends) > Date.now();
            if (!has_friend && skip_update_unknown_friends) continue;

            const friends = await user.getFriends();
            const friend = friends.find(f => f.nsaId === presence_user_nsaid);
            if (!friend) continue;

            match = [user, friend, user_naid];

            // Keep searching if the authenticated user doesn't have permission to view this user's presence
            if (friend.presence.updatedAt) break;
        }

        if (!match) {
            throw new ResponseError(404, 'not_found');
        }

        const [user, friend, user_naid] = match;
        const title = this.getTitleResult(friend, user.updated.friends, req);

        const response: PresenceResponse = {
            friend,
            title,
        };

        if (this.splatnet3_users && include_splatnet3) {
            const user = await this.getSplatNet3User(user_naid);

            await this.handleSplatoon3Presence(friend, user, response);
        }

        const images = await this.downloadImages(response, this.getResourceBaseUrls(req));

        return {...response, [ResourceUrlMapSymbol]: images};
    }

    getTitleResult(friend: Friend, updated: number, req: Request) {
        const title_cache = this.titles.get(friend.nsaId);

        if (title_cache && title_cache[1] >= updated) return title_cache[0];

        const game = 'name' in friend.presence.game ? friend.presence.game : null;
        const id = game ? getTitleIdFromEcUrl(game.shopUri) : null;

        const title: TitleResult | null = title_cache?.[0]?.id === id ? title_cache[0] : game && id ? {
            id,
            name: game.name,
            image_url: game.imageUri,
            url: 'https://fancy.org.uk/api/nxapi/title/' + encodeURIComponent(id) + '/redirect?source=' +
                encodeURIComponent('nxapi-' + version + '-presenceserver/' + req.headers.host),
            since: new Date(Math.min(Date.now(), friend.presence.updatedAt * 1000)).toISOString(),
        } : null;

        this.titles.set(friend.nsaId, [title, updated]);
        return title;
    }

    async handleSplatoon3Presence(coral_friend: Friend, user: SplatNet3User, response: PresenceResponse) {
        const is_playing_splatoon3 = 'name' in coral_friend.presence.game ?
            getTitleIdFromEcUrl(coral_friend.presence.game.shopUri) === '0100c2500fc20000' : false;

        const fest_vote_status = await user.getCurrentFestVotes();

        if (!is_playing_splatoon3 && !fest_vote_status) {
            debug('User %s (%s) is not playing Splatoon 3 and no fest data to return, skipping Splatoon 3 presence',
                coral_friend.nsaId, coral_friend.name);
            return;
        }

        const friends = await user.getFriends();

        const friend = friends.find(f => Buffer.from(f.id, 'base64').toString()
            .match(/^Friend-([0-9a-f]{16})$/)?.[1] === coral_friend.nsaId);

        if (!friend) return;

        response.splatoon3 = friend;

        if (fest_vote_status) {
            const fest = await user.getCurrentFest();

            const fest_team = this.getFestTeamVotingStatus(fest_vote_status, fest, friend);

            if (fest_team) {
                response.splatoon3_fest_team = fest_team;
            } else if (fest_vote_status.undecidedVotes) {
                response.splatoon3_fest_team = null;
            }
        }

        if ((friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ||
            friend.onlineState === FriendOnlineState.VS_MODE_FIGHTING) && friend.vsMode
        ) {
            const schedules = await user.getSchedules();
            const vs_setting = this.getSettingForVsMode(schedules, friend.vsMode);
            const vs_stages = vs_setting?.vsStages.map(stage => ({
                ...stage,
                image: schedules.vsStages.nodes.find(s => s.id === stage.id)?.originalImage ?? stage.image,
            }));

            response.splatoon3_vs_setting = vs_setting ? {...vs_setting, vsStages: vs_stages!} : null;

            if (friend.vsMode.mode === 'FEST') {
                response.splatoon3_fest = schedules.currentFest ?
                    createScheduleFest(schedules.currentFest,
                        response.splatoon3_fest_team?.id, response.splatoon3_fest_team?.myVoteState) : null;
            }
        }

        if (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ||
            friend.onlineState === FriendOnlineState.COOP_MODE_FIGHTING
        ) {
            const schedules = await user.getSchedules();
            const coop_schedules = friend.coopRule === 'BIG_RUN' ?
                schedules.coopGroupingSchedule.bigRunSchedules :
                schedules.coopGroupingSchedule.regularSchedules;
            const coop_setting = getSchedule(coop_schedules)?.setting;

            response.splatoon3_coop_setting = coop_setting ?? null;
        }
    }

    getFestTeamVotingStatus(
        fest_vote_status: Exclude<DetailVotingStatusResult['fest'], null>,
        fest: StageScheduleResult['currentFest'] | DetailFestRecordDetailResult['fest'] | null,
        friend: Friend_friendList,
    ) {
        for (const team of fest_vote_status.teams) {
            const schedule_or_detail_team = fest?.teams.find(t => t.id === team.id);
            if (!schedule_or_detail_team || !team.votes || !team.preVotes) continue;

            for (const player of team.votes.nodes) {
                if (player.userIcon.url !== friend.userIcon.url) continue;

                return {
                    ...createFestScheduleTeam(schedule_or_detail_team, FestVoteState.VOTED),
                    ...createFestVoteTeam(team, FestVoteState.VOTED),
                };
            }

            for (const player of team.preVotes.nodes) {
                if (player.userIcon.url !== friend.userIcon.url) continue;

                return {
                    ...createFestScheduleTeam(schedule_or_detail_team, FestVoteState.PRE_VOTED),
                    ...createFestVoteTeam(team, FestVoteState.PRE_VOTED),
                };
            }
        }

        return null;
    }

    getSettingForVsMode(schedules: StageScheduleResult, vs_mode: Pick<VsMode, 'id' | 'mode'>) {
        if (vs_mode.mode === 'REGULAR') {
            return getSchedule(schedules.regularSchedules)?.regularMatchSetting;
        }
        if (vs_mode.mode === 'BANKARA') {
            const settings = getSchedule(schedules.bankaraSchedules)?.bankaraMatchSettings;
            if (vs_mode.id === 'VnNNb2RlLTI=') {
                return settings?.find(s => s.mode === BankaraMatchMode.CHALLENGE);
            }
            if (vs_mode.id === 'VnNNb2RlLTUx') {
                return settings?.find(s => s.mode === BankaraMatchMode.OPEN);
            }
        }
        if (vs_mode.mode === 'FEST') {
            return getSchedule(schedules.festSchedules)?.festMatchSetting;
        }
        if (vs_mode.mode === 'LEAGUE' && 'leagueSchedules' in schedules) {
            return getSchedule((schedules as StageScheduleQuery_730cd98).leagueSchedules)?.leagueMatchSetting;
        }
        if (vs_mode.mode === 'X_MATCH') {
            return getSchedule(schedules.xSchedules)?.xMatchSetting;
        }
        return null;
    }

    async handleUserFestVotingStatusHistoryRequest(req: Request, res: Response, presence_user_nsaid: string) {
        if (!this.record_fest_votes?.read) {
            throw new ResponseError(404, 'not_found', 'Not recording fest voting status history');
        }

        // Attempt to fetch the user's current presence to make sure they are
        // still friends with the presence server user
        await this.handlePresenceRequest(req, null, presence_user_nsaid);

        const TimestampSymbol = Symbol('Timestamp');
        const VoteKeySymbol = Symbol('VoteKey');

        const response: {
            result: {
                id: string;
                fest_id: string;
                fest_team_id: string;
                fest_team: FestTeam_votingStatus;
                updated_at: string;
                [TimestampSymbol]: number;
                [VoteKeySymbol]: string;
            }[];
        } = {
            result: [],
        };

        const latest = new Map<string, [timestamp: Date, data: FestTeam_votingStatus]>();
        const all = req.query['include-all'] === '1';

        for await (const dirent of await fs.opendir(this.record_fest_votes.path)) {
            if (!dirent.isDirectory() || !dirent.name.startsWith('splatnet3-fest-votes-')) continue;

            const id = dirent.name.substr(21);
            const fest_votes_dir = path.join(this.record_fest_votes.path, dirent.name);

            for await (const dirent of await fs.opendir(fest_votes_dir)) {
                const match = dirent.name.match(/^(\d+)\.json$/);
                if (!dirent.isFile() || !match) continue;

                const timestamp = new Date(parseInt(match[1]));
                const is_latest = (latest.get(id)?.[0].getTime() ?? 0) <= timestamp.getTime();

                if (!all && !is_latest) continue;

                try {
                    const data: FestVotingStatusRecord =
                        JSON.parse(await fs.readFile(path.join(fest_votes_dir, dirent.name), 'utf-8'));

                    const friend = data.friends.result.nodes.find(f => Buffer.from(f.id, 'base64').toString()
                        .match(/^Friend-([0-9a-f]{16})$/)?.[1] === presence_user_nsaid);
                    if (!friend) continue;

                    const fest_team = this.getFestTeamVotingStatus(data.result, data.fest, friend);
                    if (!fest_team) continue;

                    const fest_id = data.fest ?
                        Buffer.from(data.fest.id, 'base64').toString()
                            .match(/^Fest-([A-Z]{2}):(([A-Z]+)-(\d+))$/)?.[2] || data.fest.id :
                        null;
                    if (!fest_id) continue;

                    const fest_team_id =
                        Buffer.from(fest_team.id, 'base64').toString()
                            .match(/^FestTeam-([A-Z]{2}):((([A-Z]+)-(\d+)):([A-Za-z]+))$/)?.[2] || fest_team.id;

                    if (is_latest) latest.set(id, [timestamp, fest_team]);

                    if (!all) {
                        let index;
                        while ((index = response.result.findIndex(r => r.id === id)) >= 0) {
                            response.result.splice(index, 1);
                        }
                    }

                    response.result.push({
                        id,
                        fest_id,
                        fest_team_id,
                        fest_team,
                        updated_at: timestamp.toISOString(),
                        [TimestampSymbol]: timestamp.getTime(),
                        [VoteKeySymbol]: fest_id + '/' + fest_team_id + '/' + fest_team.myVoteState,
                    });
                } catch (err) {
                    debug('Error reading fest voting status records', id, match[1], err);
                }
            }
        }

        if (!response.result.length) throw new ResponseError(404, 'not_found', 'No fest voting status history for this user');

        response.result.sort((a, b) => a[TimestampSymbol] - b[TimestampSymbol]);

        response.result = response.result.filter((result, index, results) => {
            const prev_result = results[index - 1];
            return !prev_result || result[VoteKeySymbol] !== prev_result[VoteKeySymbol];
        });

        response.result.reverse();

        const images = await this.downloadImages(response.result, this.getResourceBaseUrls(req));

        return {...response, [ResourceUrlMapSymbol]: images};
    }

    presence_streams = new Set<EventStreamResponse>();

    async handlePresenceStreamRequest(req: Request, res: Response, presence_user_nsaid: string) {
        const req_url = new URL(req.url, 'http://localhost');
        const presence_url = new URL('/api/presence/' + encodeURIComponent(presence_user_nsaid), req_url);
        res.setHeader('Link', '<' + encodeURI(presence_url.pathname + req_url.search) +
            '>; rel="alternate"; type="application/json"');

        res.setHeader('Access-Control-Allow-Origin', '*');

        const result = await this.handlePresenceRequest(req, null, presence_user_nsaid, true);

        const stream = new EventStreamResponse(req, res);
        stream.json_replacer = replacer;

        this.presence_streams.add(stream);
        res.on('close', () => this.presence_streams.delete(stream));

        stream.sendEvent(null, 'debug: timestamp ' + new Date().toISOString());

        stream.sendEvent('supported_events', [
            'friend',
            'title',
            ...(this.splatnet3_users && req.query['include-splatoon3'] === '1' ? [
                'splatoon3',
                'splatoon3_fest_team',
                'splatoon3_vs_setting',
                'splatoon3_coop_setting',
                'splatoon3_fest',
            ] : []),
        ]);

        for (const [key, value] of Object.entries(result) as
            [keyof typeof result, typeof result[keyof typeof result]][]
        ) {
            if (typeof key !== 'string') continue;
            stream.sendEvent(key, {...value, [ResourceUrlMapSymbol]: result[ResourceUrlMapSymbol]});
        }

        await new Promise(rs => setTimeout(rs, this.update_interval));

        let last_result = result;

        while (!req.socket.closed) {
            try {
                debug('Updating data for event stream %d', stream.id);
                const result = await this.handlePresenceRequest(req, null, presence_user_nsaid, true);

                stream.sendEvent('update', 'debug: timestamp ' + new Date().toISOString());

                for (const [key, value] of Object.entries(result) as
                    [keyof typeof result, typeof result[keyof typeof result]][]
                ) {
                    if (typeof key !== 'string') continue;
                    if (JSON.stringify(value) === JSON.stringify(last_result[key])) continue;
                    stream.sendEvent(key, {...value, [ResourceUrlMapSymbol]: result[ResourceUrlMapSymbol]});
                }

                last_result = result;

                await new Promise(rs => setTimeout(rs, this.update_interval));
            } catch (err) {
                if (err instanceof ErrorResponse) {
                    const retry_after = err.response.headers.get('Retry-After');

                    if (retry_after && /^\d+$/.test(retry_after)) {
                        stream.sendEvent(null, 'debug: timestamp ' + new Date().toISOString(), {
                            error: 'unknown_error',
                            error_message: (err as Error).message,
                            ...err,
                        });

                        await new Promise(rs => setTimeout(rs, parseInt(retry_after) * 1000));

                        continue;
                    }
                }

                stream.sendErrorEvent(err);

                debug('Error in event stream %d', stream.id, err);

                res.end();
                break;
            }
        }
    }

    async handleSplatNet3ProxyFriends(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.getSplatNet3UserBySessionToken(token);

        await user.getFriends();
        return {result: user.friends};
    }

    async handleSplatNet3ProxySchedules(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.getSplatNet3UserBySessionToken(token);

        await user.getSchedules();
        return {result: user.schedules!};
    }

    async handleSplatNet3ProxyCurrentFest(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.getSplatNet3UserBySessionToken(token);

        await user.getCurrentFest();
        return {result: user.current_fest};
    }

    async handleSplatNet3ProxyCurrentFestVotingStatus(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.getSplatNet3UserBySessionToken(token);

        await user.getCurrentFestVotes();
        return {result: user.fest_vote_status};
    }

    async downloadImages(data: unknown, base_url: {
        baas: string | null;
        atum: string | null;
        splatnet3: string | null;
    }): Promise<Record<string, string>> {
        const image_urls: [url: string, dir: string, base_url: string][] = [];

        // Use JSON.stringify to iterate over everything in the response
        JSON.stringify(data, (key: string, value: unknown) => {
            if (this.image_proxy_path_baas && base_url.baas) {
                if (typeof value === 'string' &&
                    value.startsWith('https://cdn-image-e0d67c509fb203858ebcb2fe3f88c2aa.baas.nintendo.com/')
                ) {
                    image_urls.push([value, this.image_proxy_path_baas, base_url.baas]);
                }
            }

            if (this.image_proxy_path_atum && base_url.atum) {
                if (typeof value === 'string' &&
                    value.startsWith('https://atum-img-lp1.cdn.nintendo.net/')
                ) {
                    image_urls.push([value, this.image_proxy_path_atum, base_url.atum]);
                }
            }

            if (this.image_proxy_path_splatnet3 && base_url.splatnet3) {
                if (typeof value === 'object' && value && 'url' in value && typeof value.url === 'string') {
                    if (value.url.toLowerCase().startsWith('https://api.lp1.av5ja.srv.nintendo.net/')) {
                        image_urls.push([value.url, this.image_proxy_path_splatnet3, base_url.splatnet3]);
                    }
                }
            }

            return value;
        });

        const url_map: Record<string, string> = {};

        await Promise.all(image_urls.map(async ([url, dir, base_url]) => {
            url_map[url] = new URL(await this.downloadImage(url, dir), base_url).toString();
        }));

        return url_map;
    }

    getResourceBaseUrls(req: Request) {
        const base_url = process.env.BASE_URL ??
            (req.headers['x-forwarded-proto'] === 'https' ? 'https://' : 'http://') +
            req.headers.host;

        return {
            baas: this.image_proxy_path_baas ? base_url + '/api/presence/resources/baas/' : null,
            atum: this.image_proxy_path_atum ? base_url + '/api/presence/resources/atum/' : null,
            splatnet3: this.image_proxy_path_splatnet3 ? base_url + '/api/splatnet3/resources/' : null,
        };
    }

    downloadImage(url: string, dir: string) {
        const pathname = new URL(url).pathname;
        const name = pathname.substr(1).toLowerCase()
            .replace(/^resources\//g, '')
            .replace(/(\/|^)\.\.(\/|$)/g, '$1...$2') +
            (path.extname(pathname) ? '' : '.jpeg');

        const promise = this.promise_image.get(dir + '/' + name) ?? Promise.resolve().then(async () => {
            try {
                await fs.stat(path.join(dir, name));
                return name;
            } catch (err) {}

            debug('Fetching image %s', name);
            const response = await fetch(url);
            const data = new Uint8Array(await response.arrayBuffer());

            if (!response.ok) throw new ErrorResponse('Unable to download resource ' + name, response, data.toString());

            await mkdirp(path.dirname(path.join(dir, name)));
            await fs.writeFile(path.join(dir, name), data);

            debug('Downloaded image %s', name);

            return name;
        }).then(result => {
            this.promise_image.delete(dir + '/' + name);
            return result;
        }).catch(err => {
            this.promise_image.delete(dir + '/' + name);
            throw err;
        });

        this.promise_image.set(dir + '/' + name, promise);

        return promise;
    }
}

function createScheduleFest(
    fest: Fest_schedule, vote_team?: string, state?: FestVoteState | null
): Fest_schedule {
    return {
        ...fest,
        teams: fest.teams.map(t => createFestScheduleTeam(t, t.id === vote_team ? state : null)),
    };
}

function createFestScheduleTeam(
    team: FestTeam_schedule, state: FestVoteState | null = null
): FestTeam_schedule {
    return {
        id: team.id,
        color: team.color,
        myVoteState: state,
    };
}

function createFestVoteTeam(
    team: FestTeam_votingStatus, state: FestVoteState | null
): FestTeam_votingStatus {
    return {
        id: team.id,
        teamName: team.teamName,
        image: {
            url: team.image.url,
        },
        color: team.color,
        votes: {nodes: []},
        preVotes: {nodes: []},
    };
}

function replacer(key: string, value: any, data: unknown) {
    const url_map = data && typeof data === 'object' && ResourceUrlMapSymbol in data &&
        data[ResourceUrlMapSymbol] && typeof data[ResourceUrlMapSymbol] === 'object' ?
            data[ResourceUrlMapSymbol] as Partial<Record<string, string>> : null;

    if (typeof value === 'string') {
        return url_map?.[value] ?? value;
    }

    if (typeof value === 'object' && value && 'url' in value && typeof value.url === 'string') {
        return {
            ...value,
            url: url_map?.[value.url] ?? value.url,
        };
    }

    return value;
}

function getSplatoon3inkUrl(image_url: string) {
    const url = new URL(image_url);
    if (!url.hostname.endsWith('.nintendo.net')) return image_url;
    const path = url.pathname.replace(/^\/resources\/prod\//, '/');
    return 'https://splatoon3.ink/assets/splatnet' + path;
}

function getSchedule<T extends {startTime: string; endTime: string;}>(schedules: T[] | {nodes: T[]}): T | null {
    if ('nodes' in schedules) schedules = schedules.nodes;
    const now = Date.now();

    for (const schedule of schedules) {
        const start = new Date(schedule.startTime);
        const end = new Date(schedule.endTime);

        if (start.getTime() >= now) continue;
        if (end.getTime() < now) continue;

        return schedule;
    }

    return null;
}
