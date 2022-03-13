import createDebug from 'debug';
import persist from 'node-persist';
import DiscordRPC from 'discord-rpc';
import fetch from 'node-fetch';
import { CurrentUser, Friend, Presence, PresenceState } from '../api/znc-types.js';
import ZncApi from '../api/znc.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getDiscordPresence, getTitleIdFromEcUrl, getToken, initStorage, SavedToken, YargsArguments } from '../util.js';
import { ZncNotifications } from './notify.js';
import ZncProxyApi from '../api/znc-proxy.js';

const debug = createDebug('cli:presence');
const debugProxy = createDebug('cli:presence:proxy');
const debugDiscord = createDebug('cli:presence:discordrpc');

export const command = 'presence';
export const desc = 'Start Discord Rich Presence';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('friend-naid', {
        describe: 'Friend\'s Nintendo Account ID',
        type: 'string',
    }).option('friend-code', {
        describe: 'Friend code',
        type: 'string',
    }).option('user-notifications', {
        describe: 'Show notification for your own user',
        type: 'boolean',
        default: false,
    }).option('friend-notifications', {
        describe: 'Show notification for friends',
        type: 'boolean',
        default: false,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        default: 30,
    }).option('presence-url', {
        describe: 'URL to get user presence from, for use with `nintendo-znc http-server`',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presenceUrl) {
        if (argv.token) throw new Error('--presence-url not compatible with --user');
        if (argv.token) throw new Error('--presence-url not compatible with --token');
        if (argv.friendNaid) throw new Error('--presence-url not compatible with --friend-naid');
        if (argv.userNotifications) throw new Error('--presence-url not compatible with --user-notifications');
        if (argv.friendNotifications) throw new Error('--presence-url not compatible with --user-notifications');

        const i = new ZncProxyDiscordPresence(argv, argv.presenceUrl);

        console.log('Not authenticated; using znc proxy');

        await i.init();

        while (true) {
            await i.loop();
        }

        return;
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid) ||
        await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const i = new ZncDiscordPresence(argv, storage, token, nso, data);

    console.log('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    await i.init();

    while (true) {
        await i.loop();
    }
}

class ZncDiscordPresence extends ZncNotifications {
    forceFriendCode: CurrentUser['links']['friendCode'] | undefined;

    constructor(
        readonly argv: ArgumentsCamelCase<Arguments>,
        storage: persist.LocalStorage,
        token: string,
        nso: ZncApi,
        data: Omit<SavedToken, 'expires_at'>,
    ) {
        super(argv, storage, token, nso, data);

        let match;
        this.forceFriendCode =
            (match = (this.argv.friendCode as string)?.match(/^(SW-)?(\d{4})-?(\d{4})-?(\d{4})$/)) ?
                {id: match[2] + '-' + match[3] + '-' + match[4], regenerable: false, regenerableAt: 0} : undefined;
    }

    async init() {
        const announcements = await this.nso.getAnnouncements();
        const friends = this.argv.friendNotifications || !(this.nso instanceof ZncProxyApi) ?
            await this.nso.getFriendList() : {result: {friends: this.argv.friendNaid ? [this.argv.userNotifications ?
                (await this.nso.fetch<{friend: Friend}>('/friend/' + this.argv.friendNaid)).friend : {
                    id: 0,
                    nsaId: this.argv.friendNaid,
                    imageUri: '',
                    name: '',
                    isFriend: true,
                    isFavoriteFriend: false,
                    isServiceUser: true,
                    friendCreatedAt: 0,
                    presence: await this.nso.fetch<Presence>('/friend/' + this.argv.friendNaid + '/presence'),
                }] : []}};
        if (!(this.nso instanceof ZncProxyApi)) {
            await this.nso.getWebServices();
            await this.nso.getActiveEvent();
        }

        if (this.argv.friendNaid) {
            const friend = friends.result.friends.find(f => f.nsaId === this.argv.friendNaid);

            if (!friend) {
                throw new Error('User "' + this.argv.friendNaid + '" is not friends with this user');
            }

            if (this.argv.userNotifications && this.argv.friendNotifications) {
                await this.updateFriendsStatusForNotifications(friends.result.friends, true);
            } else if (this.argv.friendNotifications) {
                await this.updateFriendsStatusForNotifications(
                    friends.result.friends.filter(f => f.nsaId !== this.argv.friendNaid), true);
            } else if (this.argv.userNotifications && friend) {
                await this.updateFriendsStatusForNotifications([friend], true);
            }

            await this.updatePresence(friend.presence);
        } else {
            const user = await this.nso.getCurrentUser();

            if (this.argv.friendNotifications) {
                await this.updateFriendsStatusForNotifications(this.argv.userNotifications ?
                    [user.result, ...friends.result.friends] : friends.result.friends);
            } else if (this.argv.userNotifications) {
                await this.updateFriendsStatusForNotifications([user.result]);
            }

            await this.updatePresence(user.result.presence, user.result.links.friendCode);
        }

        await new Promise(rs => setTimeout(rs, this.argv.updateInterval * 1000));
    }

    rpc: {client: DiscordRPC.Client, id: string} | null = null;
    title: {id: string; since: number} | null = null;
    i = 0;

    async updatePresence(presence: Presence | null, friendcode?: CurrentUser['links']['friendCode']) {
        debug('Presence %d state=%s, updatedAt=%s, logoutAt=%s', this.i++,
            presence?.state,
            new Date((presence?.updatedAt ?? 0) * 1000).toString(),
            new Date((presence?.logoutAt ?? 0) * 1000).toString());
        if (presence && 'name' in presence.game) {
            debug('Title %s, id=%s, totalPlayTime=%d, firstPlayedAt=%s, sysDescription=%s',
                presence.game.name,
                getTitleIdFromEcUrl(presence.game.shopUri),
                presence.game.totalPlayTime,
                new Date((presence.game.firstPlayedAt ?? 0) * 1000).toString(),
                JSON.stringify(presence.game.sysDescription));
        }

        const online = presence?.state === PresenceState.ONLINE || presence?.state === PresenceState.PLAYING;

        if (online && 'name' in presence.game) {
            const discordpresence = getDiscordPresence(presence.game,
                this.argv.friendCode === '' || this.argv.friendCode === '-' ? friendcode : this.forceFriendCode);

            if (this.rpc && this.rpc.id !== discordpresence.id) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            }

            if (!this.rpc) {
                const client = new DiscordRPC.Client({transport: 'ipc'});
                let attempts = 0;
                let connected = false;

                while (attempts < 10) {
                    if (attempts === 0) debugDiscord('RPC connecting');
                    else debugDiscord('RPC connecting, attempt %d', attempts + 1);

                    try {
                        await client.connect(discordpresence.id);
                        debugDiscord('RPC connected');
                        connected = true;
                        break;
                    } catch (err) {}

                    attempts++;
                    await new Promise(rs => setTimeout(rs, 5000));
                }

                if (!connected) throw new Error('Failed to connect to Discord');

                // @ts-expect-error
                client.transport.on('close', async () => {
                    if (this.rpc?.client !== client) return;

                    console.warn('[discordrpc] RPC client disconnected, attempting to reconnect');
                    debugDiscord('RPC client disconnected');
                    let attempts = 0;
                    let connected = false;

                    while (attempts < 10) {
                        if (this.rpc?.client !== client) return;

                        debugDiscord('RPC reconnecting, attempt %d', attempts + 1);
                        try {
                            await client.connect(discordpresence.id);
                            console.warn('[discordrpc] RPC reconnected');
                            debugDiscord('RPC reconnected');
                            connected = true;
                            break;
                        } catch (err) {}

                        attempts++;
                        await new Promise(rs => setTimeout(rs, 5000));
                    }

                    if (!connected) throw new Error('Failed to reconnect to Discord');

                    throw new Error('Discord disconnected');
                });

                this.rpc = {client, id: discordpresence.id};
            }

            if (discordpresence.title) {
                if (discordpresence.title !== this.title?.id) {
                    this.title = {id: discordpresence.title, since: Date.now()};
                }

                if (discordpresence.showTimestamp) {
                    discordpresence.presence.startTimestamp = this.title.since;
                }
            } else {
                this.title = null;
            }

            this.rpc.client.setActivity(discordpresence.presence);
        }

        if (!presence || !online || !('name' in presence.game)) {
            if (this.rpc) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            }

            this.title = null;
        }
    }

    async update() {
        if (this.argv.friendNaid) {
            if (!(this.nso instanceof ZncProxyApi)) await this.nso.getActiveEvent();
            const friends = this.argv.friendNotifications || !(this.nso instanceof ZncProxyApi) ?
                await this.nso.getFriendList() : {result: {friends: this.argv.friendNaid ? [this.argv.userNotifications ?
                    (await this.nso.fetch<{friend: Friend}>('/friend/' + this.argv.friendNaid)).friend : {
                        id: 0,
                        nsaId: this.argv.friendNaid,
                        imageUri: '',
                        name: '',
                        isFriend: true,
                        isFavoriteFriend: false,
                        isServiceUser: true,
                        friendCreatedAt: 0,
                        presence: await this.nso.fetch<Presence>('/friend/' + this.argv.friendNaid + '/presence'),
                    }] : []}};
            if (!(this.nso instanceof ZncProxyApi)) await this.nso.getWebServices();

            const friend = friends.result.friends.find(f => f.nsaId === this.argv.friendNaid);

            if (this.argv.userNotifications && this.argv.friendNotifications) {
                await this.updateFriendsStatusForNotifications(friends.result.friends);
            } else if (this.argv.friendNotifications) {
                await this.updateFriendsStatusForNotifications(
                    friends.result.friends.filter(f => f.nsaId !== this.argv.friendNaid));
            } else if (this.argv.userNotifications && friend) {
                await this.updateFriendsStatusForNotifications([friend]);
            }

            if (!friend) {
                // Is the authenticated user no longer friends with this user?
                await this.updatePresence(null);
                return;
            }

            await this.updatePresence(friend.presence);
        } else {
            const user = !(this.nso instanceof ZncProxyApi) ?
                await this.nso.getCurrentUser() : {result: {
                    ...this.data.nsoAccount.user,
                    presence: await this.nso.fetch<Presence>('/user/presence'),
                }};

            if (this.argv.friendNotifications) {
                if (!(this.nso instanceof ZncProxyApi)) await this.nso.getActiveEvent();
                const friends = await this.nso.getFriendList();
                if (!(this.nso instanceof ZncProxyApi)) await this.nso.getWebServices();
    
                await this.updateFriendsStatusForNotifications(this.argv.userNotifications ?
                    [user.result, ...friends.result.friends] : friends.result.friends);
            } else if (this.argv.userNotifications) {
                await this.updateFriendsStatusForNotifications([user.result]);
            }

            await this.updatePresence(user.result.presence, user.result.links.friendCode);
        }
    }
}

class ZncProxyDiscordPresence extends ZncDiscordPresence {
    constructor(
        readonly argv: ArgumentsCamelCase<Arguments>,
        public presence_url: string
    ) {
        super(argv, null!, null!, null!, null!);
    }

    async init() {
        await this.update();

        await new Promise(rs => setTimeout(rs, this.argv.updateInterval * 1000));
    }

    async update() {
        const response = await fetch(this.presence_url);
        debugProxy('fetch %s %s, response %s', 'GET', this.presence_url, response.status);
        if (response.status !== 200) {
            console.error('Non-200 status code', await response.text());
            throw new Error('Unknown error');
        }
        const presence = await response.json() as Presence;

        await this.updatePresence(presence);
    }
}
