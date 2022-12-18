import * as net from 'node:net';
import * as os from 'node:os';
import createDebug from 'debug';
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import * as persist from 'node-persist';
import { BankaraMatchMode, BankaraMatchSetting_schedule, CoopSetting_schedule, DetailVotingStatusResult, FestMatchSetting_schedule, FestState, FestTeam_schedule, FestTeam_votingStatus, FestVoteState, Fest_schedule, FriendListResult, FriendOnlineState, Friend_friendList, GraphQLSuccessResponse, LeagueMatchSetting_schedule, RegularMatchSetting_schedule, StageScheduleResult, VsMode, XMatchSetting_schedule } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';
import { initStorage } from '../util/storage.js';
import { addCliFeatureUserAgent, getUserAgent } from '../util/useragent.js';
import { parseListenAddress } from '../util/net.js';
import { product, version } from '../util/product.js';
import Users, { CoralUser } from '../common/users.js';
import { Friend } from '../api/coral-types.js';
import { getBulletToken, SavedBulletToken } from '../common/auth/splatnet3.js';
import SplatNet3Api from '../api/splatnet3.js';
import { ErrorResponse } from '../api/util.js';
import { EventStreamResponse, HttpServer, ResponseError } from './util/http-server.js';
import { getTitleIdFromEcUrl } from '../util/misc.js';

const debug = createDebug('cli:presence-server');
const debugSplatnet3Proxy = createDebug('cli:presence-server:splatnet3-proxy');

interface AllUsersResult extends Friend {
    title: TitleResult | null;
    splatoon3?: Friend_friendList | null;
    splatoon3_fest_team?: FestTeam_votingStatus | null;
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

    const server = new Server(storage, coral_users, splatnet3_users, user_naids);
    server.allow_all_users = argv.allowAllUsers;
    server.enable_splatnet3_proxy = argv.splatnet3Proxy;
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

abstract class SplatNet3User {
    created_at = Date.now();
    expires_at = Infinity;

    schedules: GraphQLSuccessResponse<StageScheduleResult> | null = null;
    fest_vote_status: GraphQLSuccessResponse<DetailVotingStatusResult> | null = null;

    promise = new Map<string, Promise<void>>();

    updated = {
        friends: Date.now(),
        schedules: null as number | null,
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

    async getCurrentFestVotes(): Promise<DetailVotingStatusResult['fest'] | null> {
        await this.update('fest_vote_status', async () => {
            this.fest_vote_status = await this.getCurrentFestVotingStatusData();
        }, this.update_interval_fest_voting_status ?? this.update_interval);

        return this.fest_vote_status?.data.fest ?? null;
    }

    abstract getCurrentFestVotingStatusData(): Promise<GraphQLSuccessResponse<DetailVotingStatusResult> | null>;
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

    async getCurrentFestVotingStatusData() {
        const schedules = await this.getSchedules();
        return !schedules.currentFest || new Date(schedules.currentFest.endTime).getTime() <= Date.now() ? null :
            await this.getFestVotingStatusData(schedules.currentFest.id);
    }

    async getFestVotingStatusData(id: string) {
        return this.fest_vote_status?.data.fest?.id === id ?
            await this.splatnet.getFestVotingStatusRefetch(id) :
            await this.splatnet.getFestVotingStatus(id);
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

    update_interval = 30 * 1000;
    /** Interval coral friends data should be updated if the requested user isn't friends with the authenticated user */
    update_interval_unknown_friends = 10 * 60 * 1000; // 10 minutes

    app: express.Express;

    titles = new Map</** NSA ID */ string, [TitleResult | null, /** updated */ number]>();

    constructor(
        readonly storage: persist.LocalStorage,
        readonly coral_users: Users<CoralUser>,
        readonly splatnet3_users: Users<SplatNet3User> | null,
        readonly user_ids: string[],
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
        app.get('/api/presence/:user/events', this.createApiRequestHandler((req, res) =>
            this.handlePresenceStreamRequest(req, res, req.params.user)));

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
        app.get('/api/splatnet3-presence/fest/current/voting-status', this.createApiRequestHandler((req, res) =>
            this.handleSplatNet3ProxyCurrentFestVotingStatus(req, res)));
    }

    protected encodeJsonForResponse(data: unknown, space?: number) {
        return JSON.stringify(data, replacer, space);
    }

    async handleAllUsersRequest(req: Request, res: Response) {
        if (!this.allow_all_users) {
            throw new ResponseError(403, 'forbidden');
        }

        const include_splatnet3 = this.splatnet3_users && req.query['include-splatoon3'] === '1';

        const result: AllUsersResult[] = [];

        const users = await Promise.all(this.user_ids.map(async id => {
            const token = await this.storage.getItem('NintendoAccountToken.' + id);
            const user = await this.coral_users.get(token);
            user.update_interval = this.update_interval;
            return user;
        }));

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
            const users = await Promise.all(this.user_ids.map(async id => {
                const token = await this.storage.getItem('NintendoAccountToken.' + id);
                const user = await this.splatnet3_users!.get(token);
                user.update_interval = this.update_interval;
                return user;
            }));

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

                                match.splatoon3_fest_team = createFestVoteTeam(team, FestVoteState.VOTED);
                                break;
                            }

                            if (match.splatoon3_fest_team) break;
                            
                            for (const player of team.preVotes.nodes) {
                                if (player.userIcon.url !== friend.userIcon.url) continue;

                                match.splatoon3_fest_team = createFestVoteTeam(team, FestVoteState.PRE_VOTED);
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

        return {result};
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
            const token = await this.storage.getItem('NintendoAccountToken.' + user_naid);
            const user = await this.splatnet3_users!.get(token);
            user.update_interval = this.update_interval;

            await this.handleSplatoon3Presence(friend, user, response);
        }

        return response;
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
                encodeURIComponent('nxapi-' + version + '-presenceserver-' + req.headers.host),
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
            const schedules = await user.getSchedules();

            for (const team of fest_vote_status.teams) {
                const schedule_team = schedules.currentFest?.teams.find(t => t.id === team.id);
                if (!schedule_team || !team.votes || !team.preVotes) continue; // Shouldn't ever happen

                for (const player of team.votes.nodes) {
                    if (player.userIcon.url !== friend.userIcon.url) continue;

                    response.splatoon3_fest_team = {
                        ...createFestScheduleTeam(schedule_team, FestVoteState.VOTED),
                        ...createFestVoteTeam(team, FestVoteState.VOTED),
                    };
                    break;
                }

                if (response.splatoon3_fest_team) break;

                for (const player of team.preVotes.nodes) {
                    if (player.userIcon.url !== friend.userIcon.url) continue;

                    response.splatoon3_fest_team = {
                        ...createFestScheduleTeam(schedule_team, FestVoteState.PRE_VOTED),
                        ...createFestVoteTeam(team, FestVoteState.PRE_VOTED),
                    };
                    break;
                }

                if (response.splatoon3_fest_team) break;
            }

            if (!response.splatoon3_fest_team && fest_vote_status.undecidedVotes) {
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
        if (vs_mode.mode === 'LEAGUE') {
            return getSchedule(schedules.leagueSchedules)?.leagueMatchSetting;
        }
        if (vs_mode.mode === 'X_MATCH') {
            return getSchedule(schedules.xSchedules)?.xMatchSetting;
        }
        return null;
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
            stream.sendEvent(key, value);
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
                    if (JSON.stringify(value) === JSON.stringify(last_result[key])) continue;

                    stream.sendEvent(key, value);
                }

                last_result = result;

                await new Promise(rs => setTimeout(rs, this.update_interval));
            } catch (err) {
                if (err instanceof ErrorResponse) {
                    const retry_after = err.response.headers.get('Retry-After');

                    if (retry_after && /^\d+$/.test(retry_after)) {
                        stream.sendEvent(null, 'debug: timestamp ' + new Date().toISOString(), {
                            error: err,
                            error_message: (err as Error).message,
                        });

                        await new Promise(rs => setTimeout(rs, parseInt(retry_after) * 1000));

                        continue;
                    }
                }

                if (err instanceof ResponseError) {
                    stream.sendEvent('error', {
                        error: err.code,
                        error_message: err.message,
                    });
                } else {
                    stream.sendEvent('error', {
                        error: err,
                        error_message: (err as Error).message,
                    });
                }

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

        const user = await this.splatnet3_users!.get(token);
        user.update_interval = this.update_interval;

        await user.getFriends();
        return {result: user.friends};
    }

    async handleSplatNet3ProxySchedules(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.splatnet3_users!.get(token);
        user.update_interval = this.update_interval;

        await user.getSchedules();
        return {result: user.schedules!};
    }

    async handleSplatNet3ProxyCurrentFestVotingStatus(req: Request, res: Response) {
        if (!this.enable_splatnet3_proxy) throw new ResponseError(403, 'forbidden');

        const token = req.headers.authorization?.substr(0, 3) === 'na ' ?
            req.headers.authorization.substr(3) : null;
        if (!token) throw new ResponseError(401, 'unauthorised');

        const user = await this.splatnet3_users!.get(token);
        user.update_interval = this.update_interval;

        await user.getCurrentFestVotes();
        return {result: user.fest_vote_status};
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
            url: getSplatoon3inkUrl(team.image.url),
        },
        color: team.color,
        votes: {nodes: []},
        preVotes: {nodes: []},
    };
}

function replacer(key: string, value: any) {
    if ((key === 'image' || key.endsWith('Image')) && value && typeof value === 'object' && 'url' in value) {
        return {
            ...value,
            url: getSplatoon3inkUrl(value.url),
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
