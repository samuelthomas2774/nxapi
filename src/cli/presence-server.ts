import * as net from 'node:net';
import createDebug from 'debug';
import express, { Request, Response } from 'express';
import * as persist from 'node-persist';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';
import { initStorage } from '../util/storage.js';
import { SavedToken } from '../common/auth/coral.js';
import { addCliFeatureUserAgent } from '../util/useragent.js';
import { parseListenAddress } from '../util/net.js';
import { product } from '../util/product.js';
import Users, { CoralUser } from '../common/users.js';
import { Friend } from '../api/coral-types.js';
import { getBulletToken, SavedBulletToken } from '../common/auth/splatnet3.js';
import SplatNet3Api from '../api/splatnet3.js';
import { BankaraMatchMode, DetailVotingStatusResult, FestState, FestVoteState, FriendListResult, FriendOnlineState, GraphQLResponse, StageScheduleResult } from '../api/splatnet3-types.js';

const debug = createDebug('cli:presence-server');

export const command = 'presence-server';
export const desc = 'Starts a HTTP server to fetch presence data from Coral and SplatNet 3';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'array',
        default: null,
    }).option('splatnet3', {
        describe: 'Enable SplatNet 3 presence',
        type: 'boolean',
        default: false,
    }).option('allow-all-users', {
        describe: 'Enable returning all users',
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

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    addCliFeatureUserAgent('presence-server');

    const storage = await initStorage(argv.dataPath);

    const user_naid: string | undefined = !argv.user ? await storage.getItem('SelectedUser') : undefined;
    const user_naids = argv.user ?? (user_naid ? [user_naid] : []);

    if (!user_naids.length) {
        throw new Error('No user selected');
    }

    const coral_users = Users.coral(storage, argv.zncProxyUrl);

    const splatnet3_users = argv.splatnet3 ? new Users(async token => {
        const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, true);

        const friends = await splatnet.getFriends();
        await splatnet.getCurrentFest();
        await splatnet.getConfigureAnalytics();

        return new SplatNet3User(splatnet, data, friends);
    }) : null;

    const app = createApp(
        storage, coral_users, splatnet3_users, user_naids,
        argv.allowAllUsers, argv.updateInterval * 1000
    );

    for (const address of argv.listen) {
        const [host, port] = parseListenAddress(address);
        const server = app.listen(port, host ?? '::');
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log('Listening on %s, port %d', address.address, address.port);
        });
    }
}

export class SplatNet3User {
    created_at = Date.now();
    expires_at = Infinity;

    schedules: GraphQLResponse<StageScheduleResult> | null = null;
    fest_vote_status: GraphQLResponse<DetailVotingStatusResult> | null = null;

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
        public splatnet: SplatNet3Api,
        public data: SavedBulletToken,
        public friends: GraphQLResponse<FriendListResult>,
    ) {}

    private async update(key: keyof SplatNet3User['updated'], callback: () => Promise<void>, ttl: number) {
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

    async getFriends(): Promise<FriendListResult['friends']> {
        await this.update('friends', async () => {
            this.friends = await this.splatnet.getFriendsRefetch();
        }, this.update_interval);

        return this.friends.data.friends;
    }

    async getSchedules(): Promise<StageScheduleResult> {
        let update_interval = this.update_interval_schedules;

        if (this.schedules && this.schedules.data.currentFest) {
            const tricolour_open = new Date(this.schedules.data.currentFest.midtermTime).getTime() <= Date.now();
            const should_refresh_fest = tricolour_open &&
                ![FestState.SECOND_HALF, FestState.CLOSED].includes(this.schedules.data.currentFest.state);

            if (should_refresh_fest) update_interval = this.update_interval;
        }

        await this.update('schedules', async () => {
            this.schedules = await this.splatnet.getSchedules();
        }, update_interval);

        return this.schedules!.data;
    }

    async getCurrentFestVotes(): Promise<DetailVotingStatusResult['fest'] | null> {
        await this.update('fest_vote_status', async () => {
            const schedules = await this.getSchedules();
            this.fest_vote_status = !schedules.currentFest ? null : this.fest_vote_status ?
                await this.splatnet.getFestVotingStatusRefetch(schedules.currentFest.id) :
                await this.splatnet.getFestVotingStatus(schedules.currentFest.id);
        }, this.update_interval_fest_voting_status ?? this.update_interval);

        return this.fest_vote_status?.data.fest ?? null;
    }
}

function createApp(
    storage: persist.LocalStorage,
    coral_users: Users<CoralUser>,
    splatnet3_users: Users<SplatNet3User> | null,
    user_ids: string[],
    allow_all_users = false,
    update_interval = 30 * 1000
) {
    const app = express();

    app.use('/api/presence', (req, res, next) => {
        console.log('[%s] %s %s HTTP/%s from %s, port %d%s, %s',
            new Date(), req.method, req.url, req.httpVersion,
            req.socket.remoteAddress, req.socket.remotePort,
            req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
            req.headers['user-agent']);

        res.setHeader('Server', product + ' presence-server');

        next();
    });

    app.get('/api/presence', async (req, res) => {
        if (!allow_all_users) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'forbidden',
            }));
            return;
        }

        try {
            const include_splatnet3 = splatnet3_users && req.query['include-splatoon3'] === '1';

            const result: (Friend & {
                splatoon3?: FriendListResult['friends']['nodes'][0] | null;
                splatoon3_fest_team?: DetailVotingStatusResult['fest']['teams'][0] | null;
            })[] = [];

            const users = await Promise.all(user_ids.map(async id => {
                const token = await storage.getItem('NintendoAccountToken.' + id);
                const user = await coral_users.get(token);
                user.update_interval = update_interval;
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

                    result.push(include_splatnet3 ? Object.assign(friend, {splatoon3: null}) : friend);
                }
            }

            if (splatnet3_users && include_splatnet3) {
                const users = await Promise.all(user_ids.map(async id => {
                    const token = await storage.getItem('NintendoAccountToken.' + id);
                    const user = await splatnet3_users.get(token);
                    user.update_interval = update_interval;
                    return user;
                }));

                for (const user of users) {
                    const friends = await user.getFriends();
                    const fest_vote_status = await user.getCurrentFestVotes();

                    for (const friend of friends.nodes) {
                        const friend_nsaid = Buffer.from(friend.id, 'base64').toString()
                            .replace(/^Friend-([0-9a-f]{16})$/, '$1');
                        const match = result.find(f => f.nsaId === friend_nsaid);
                        if (!match) continue;

                        match.splatoon3 = friend;

                        if (fest_vote_status) {
                            for (const team of fest_vote_status.teams) {
                                for (const player of team.votes.nodes) {
                                    if (player.userIcon.url !== friend.userIcon.url) continue;
        
                                    match.splatoon3_fest_team = createFestVoteTeam(team, FestVoteState.VOTED);
                                    break;
                                }
        
                                for (const player of team.preVotes.nodes) {
                                    if (player.userIcon.url !== friend.userIcon.url) continue;
        
                                    match.splatoon3_fest_team = createFestVoteTeam(team, FestVoteState.PRE_VOTED);
                                    break;
                                }
                            }
        
                            if (!match.splatoon3_fest_team) {
                                match.splatoon3_fest_team = null;
                            }
                        }
                    }
                }
            }

            result.sort((a, b) => b.presence.updatedAt - a.presence.updatedAt);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({result}, replacer));
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    });

    app.get('/api/presence/:user', async (req, res) => {
        try {
            const include_splatnet3 = splatnet3_users && req.query['include-splatoon3'] === '1';

            let match_coral: Friend | null = null;
            let match_user_id: string | null = null;
            let match_splatnet3: FriendListResult['friends']['nodes'][0] | null = null;
            let match_splatnet3_fest_team:
                Exclude<StageScheduleResult['currentFest'], null>['teams'][0] | null | undefined = undefined;
            let match_splatnet3_fest_team_vote_status:
                DetailVotingStatusResult['fest']['teams'][0] | null | undefined = undefined;

            const additional_response_data: {
                splatoon3_vs_setting?:
                    StageScheduleResult['regularSchedules']['nodes'][0]['regularMatchSetting'] |
                    Exclude<StageScheduleResult['bankaraSchedules']['nodes'][0]['bankaraMatchSettings'], null>[0] |
                    StageScheduleResult['festSchedules']['nodes'][0]['festMatchSetting'] |
                    StageScheduleResult['leagueSchedules']['nodes'][0]['leagueMatchSetting'] |
                    StageScheduleResult['xSchedules']['nodes'][0]['xMatchSetting'] |
                    null;
                splatoon3_coop_setting?:
                    StageScheduleResult['coopGroupingSchedule']['regularSchedules']['nodes'][0]['setting'] | null;
                splatoon3_fest?: StageScheduleResult['currentFest'] | null;
            } = {};

            for (const user_naid of user_ids) {
                const token = await storage.getItem('NintendoAccountToken.' + user_naid);
                const user = await coral_users.get(token);
                user.update_interval = update_interval;

                const has_friend = user.friends.result.friends.find(f => f.nsaId === req.params.user);
                if (!has_friend) continue;

                const friends = await user.getFriends();
                const friend = friends.find(f => f.nsaId === req.params.user);
                if (!friend) continue;

                match_coral = friend;
                match_user_id = user_naid;

                // Keep searching if the authenticated user doesn't have permission to view this user's presence
                if (friend.presence.updatedAt) break;
            }

            if (!match_coral) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({error: 'not_found'}));
                return;
            }

            if (splatnet3_users && include_splatnet3) {
                const token = await storage.getItem('NintendoAccountToken.' + match_user_id);
                const user = await splatnet3_users.get(token);
                user.update_interval = update_interval;

                const friends = await user.getFriends();
                const fest_vote_status = await user.getCurrentFestVotes();

                for (const friend of friends.nodes) {
                    const friend_nsaid = Buffer.from(friend.id, 'base64').toString()
                        .replace(/^Friend-([0-9a-f]{16})$/, '$1');
                    if (match_coral.nsaId !== friend_nsaid) continue;

                    match_splatnet3 = friend;

                    if (fest_vote_status) {
                        const schedules = await user.getSchedules();

                        for (const team of fest_vote_status.teams) {
                            const schedule_team = schedules.currentFest?.teams.find(t => t.id === team.id);
                            if (!schedule_team) continue; // Shouldn't ever happen

                            for (const player of team.votes.nodes) {
                                if (player.userIcon.url !== friend.userIcon.url) continue;

                                match_splatnet3_fest_team = createFestScheduleTeam(schedule_team, FestVoteState.VOTED);
                                match_splatnet3_fest_team_vote_status = createFestVoteTeam(team, FestVoteState.VOTED);
                                break;
                            }

                            for (const player of team.preVotes.nodes) {
                                if (player.userIcon.url !== friend.userIcon.url) continue;

                                match_splatnet3_fest_team = createFestScheduleTeam(schedule_team, FestVoteState.VOTED);
                                match_splatnet3_fest_team_vote_status = createFestVoteTeam(team, FestVoteState.PRE_VOTED);
                                break;
                            }
                        }

                        if (!match_splatnet3_fest_team) {
                            match_splatnet3_fest_team = null;
                        }
                    }

                    if ((friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ||
                        friend.onlineState === FriendOnlineState.VS_MODE_FIGHTING) && friend.vsMode
                    ) {
                        const schedules = await user.getSchedules();

                        const vs_setting =
                            friend.vsMode.mode === 'REGULAR' ? getSchedule(schedules.regularSchedules)?.regularMatchSetting :
                            friend.vsMode.mode === 'BANKARA' ?
                                friend.vsMode.id === 'VnNNb2RlLTI=' ?
                                    getSchedule(schedules.bankaraSchedules)?.bankaraMatchSettings
                                        ?.find(s => s.mode === BankaraMatchMode.CHALLENGE) :
                                friend.vsMode.id === 'VnNNb2RlLTUx' ?
                                    getSchedule(schedules.bankaraSchedules)?.bankaraMatchSettings
                                        ?.find(s => s.mode === BankaraMatchMode.OPEN) :
                                null :
                            friend.vsMode.mode === 'FEST' ? getSchedule(schedules.festSchedules)?.festMatchSetting :
                            friend.vsMode.mode === 'LEAGUE' ? getSchedule(schedules.leagueSchedules)?.leagueMatchSetting :
                            friend.vsMode.mode === 'X_MATCH' ? getSchedule(schedules.xSchedules)?.xMatchSetting :
                            null;

                        additional_response_data.splatoon3_vs_setting = vs_setting ?? null;

                        if (friend.vsMode.mode === 'FEST') {
                            additional_response_data.splatoon3_fest = schedules.currentFest ?
                                createScheduleFest(schedules.currentFest,
                                    match_splatnet3_fest_team?.id, match_splatnet3_fest_team?.myVoteState) : null;
                        }
                    }

                    if (friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ||
                        friend.onlineState === FriendOnlineState.COOP_MODE_FIGHTING
                    ) {
                        const schedules = await user.getSchedules();

                        const coop_setting =
                            getSchedule(schedules.coopGroupingSchedule.regularSchedules)?.setting;

                        additional_response_data.splatoon3_coop_setting = coop_setting ?? null;
                    }

                    break;
                }
            }

            const response = {
                friend: match_coral,
                splatoon3: include_splatnet3 ? match_splatnet3 : undefined,
                splatoon3_fest_team: include_splatnet3 ? match_splatnet3_fest_team ? {
                    ...match_splatnet3_fest_team,
                    ...match_splatnet3_fest_team_vote_status,
                } : match_splatnet3_fest_team : undefined,
                ...additional_response_data,
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response, replacer));
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: err,
                error_message: (err as Error).message,
            }));
        }
    });

    return app;
}

function createScheduleFest(
    fest: Exclude<StageScheduleResult['currentFest'], null>,
    vote_team?: string, state?: FestVoteState | null
): Exclude<StageScheduleResult['currentFest'], null> {
    return {
        ...fest,
        teams: fest.teams.map(t => createFestScheduleTeam(t, t.id === vote_team ? state : null)),
    };
}

function createFestScheduleTeam(
    team: Exclude<StageScheduleResult['currentFest'], null>['teams'][0],
    state: FestVoteState | null = null
): Exclude<StageScheduleResult['currentFest'], null>['teams'][0] {
    return {
        id: team.id,
        color: team.color,
        myVoteState: state,
        role: team.role,
    };
}

function createFestVoteTeam(
    team: DetailVotingStatusResult['fest']['teams'][0],
    state?: FestVoteState | null
): DetailVotingStatusResult['fest']['teams'][0] {
    return {
        id: team.id,
        teamName: team.teamName,
        image: {
            url: getSplatoon3inkUrl(team.image.url),
        },
        color: team.color,
        myVoteState: state,
        votes: {nodes: []},
        preVotes: {nodes: []},
    };
}

function replacer(key: string, value: any) {
    if (key === 'image' || key.endsWith('Image') && value && typeof value === 'object' && 'url' in value) {
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
