import createDebug from 'debug';
import { DiscordRpcClient, findDiscordRpcClient } from '../discord/rpc.js';
import { DiscordPresencePlayTime, DiscordPresenceContext, getDiscordPresence, getInactiveDiscordPresence, DiscordPresence } from '../discord/util.js';
import { EmbeddedSplatNet2Monitor, ZncNotifications } from './notify.js';
import { getPresenceFromUrl } from '../api/znc-proxy.js';
import { ActiveEvent, CurrentUser, Friend, Game, Presence, PresenceState, CoralErrorResponse } from '../api/coral-types.js';
import { ErrorResponse } from '../api/util.js';
import Loop, { LoopResult } from '../util/loop.js';
import { getTitleIdFromEcUrl } from '../index.js';

const debug = createDebug('nxapi:nso:presence');
const debugDiscord = createDebug('nxapi:nso:presence:discordrpc');
const debugSplatnet2 = createDebug('nxapi:nso:presence:splatnet2');

const MAX_CONNECT_ATTEMPTS = Infinity; // 10
const RECONNECT_INTERVAL = 5000; // 5 seconds

class ZncDiscordPresenceClient {
    rpc: {client: DiscordRpcClient, id: string} | null = null;
    title: {id: string; since: number} | null = null;
    protected i = 0;

    last_presence: Presence | null = null;
    last_user: CurrentUser | Friend | undefined = undefined;
    last_friendcode: CurrentUser['links']['friendCode'] | undefined = undefined;
    last_event: ActiveEvent | undefined = undefined;

    last_activity: DiscordPresence | null = null;
    onUpdateActivity: ((activity: DiscordPresence | null) => void) | null = null;
    onUpdateClient: ((client: DiscordRpcClient | null) => void) | null = null;

    update_presence_errors = 0;

    constructor(
        readonly m: ZncDiscordPresence | ZncProxyDiscordPresence,
    ) {}

    async updatePresenceForDiscord(
        presence: Presence | null,
        user?: CurrentUser | Friend,
        friendcode?: CurrentUser['links']['friendCode'],
        activeevent?: ActiveEvent
    ) {
        this.last_presence = presence;
        this.last_user = user;
        this.last_friendcode = friendcode;
        this.last_event = activeevent;

        const online = presence?.state === PresenceState.ONLINE || presence?.state === PresenceState.PLAYING;

        const show_presence =
            (online && 'name' in presence.game) ||
            (this.m.show_console_online && presence?.state === PresenceState.INACTIVE);

        if (!presence || !show_presence) {
            if (this.m.presence_enabled && this.m.discord_preconnect && !this.rpc) {
                debugDiscord('No presence but Discord preconnect enabled - connecting');
                const discordpresence = getInactiveDiscordPresence(PresenceState.OFFLINE, 0);
                this.setActivity(discordpresence.id);
                return;
            }

            if (this.rpc && !(this.m.presence_enabled && this.m.discord_preconnect)) {
                this.setActivity(null);
            } else if (this.rpc && this.title) {
                debugDiscord('No presence but Discord preconnect enabled - clearing Discord activity');
                this.setActivity(this.rpc.id);
            }

            this.title = null;
            return;
        }

        const presence_context: DiscordPresenceContext = {
            friendcode: this.m.show_friend_code ? this.m.force_friend_code ?? friendcode : undefined,
            activeevent: this.m.show_active_event ? activeevent : undefined,
            show_play_time: this.m.show_play_time,
            znc_discord_presence: this.m,
            nsaid: this.m.presence_user!,
            user,
        };

        const discord_presence = 'name' in presence.game ?
            getDiscordPresence(presence.state, presence.game, presence_context) :
            getInactiveDiscordPresence(presence.state, presence.logoutAt, presence_context);

        if (discord_presence.title) {
            if (discord_presence.title !== this.title?.id) {
                // Use the timestamp the user's presence was last updated according to Nintendo
                // This may be incorrect as this will also change when the state/description changes in the
                // same title, but this shouldn't matter unless the process is restarted or presence tracking
                // is reset for some other reason (e.g. using the Electron app)
                const since = Math.min(presence.updatedAt * 1000, Date.now());

                this.title = {id: discord_presence.title, since};
            }

            if (discord_presence.showTimestamp) {
                discord_presence.activity.startTimestamp = this.title.since;
            }
        } else {
            this.title = null;
        }

        this.setActivity(discord_presence);
    }

    async setActivity(activity: DiscordPresence | string | null) {
        this.onUpdateActivity?.call(null, typeof activity === 'string' ? null : activity);
        this.last_activity = typeof activity === 'string' ? null : activity;

        if (!activity) {
            // No activity, no IPC connection
            if (this.rpc) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            }

            return;
        }

        const client_id = typeof activity === 'string' ? activity : activity.id;

        if (this.rpc && this.rpc.id !== client_id) {
            const client = this.rpc.client;
            this.rpc = null;
            await client.destroy();
        }

        if (!this.rpc) {
            this.connect(client_id, this.m.discord_client_filter);
        } else {
            this.rpc.client.setActivity(typeof activity === 'string' ? undefined : activity.activity);
        }
    }

    async connect(
        client_id: string,
        filter = (client: DiscordRpcClient, id: number) => true
    ) {
        if (this.rpc) return this.rpc.client;

        let client: DiscordRpcClient;
        let attempts = 0;
        let connected = false;
        let id;
        let i = ++this.i;

        while (attempts < MAX_CONNECT_ATTEMPTS) {
            if (this.i !== i) return;

            if (attempts === 0) debugDiscord('RPC connecting', client_id, i);
            else debugDiscord('RPC connecting, attempt %d', attempts + 1, client_id, i);

            try {
                [id, client] = await findDiscordRpcClient(client_id, filter);
                debugDiscord('RPC connected', i, id, client_id, client.application, client.user);
                connected = true;
                break;
            } catch (err) {}

            attempts++;
            await new Promise(rs => setTimeout(rs, RECONNECT_INTERVAL));
        }

        if (!connected) throw new Error('Failed to connect to Discord');

        const reconnect = async () => {
            this.onUpdateClient?.call(null, null);
            client.application = undefined;
            client.user = undefined;

            if (this.i !== i || this.rpc?.client !== client) return;

            debugDiscord('RPC client disconnected, attempting to reconnect', client_id, i);
            let attempts = 0;
            let connected = false;

            while (attempts < MAX_CONNECT_ATTEMPTS) {
                await new Promise(rs => setTimeout(rs, RECONNECT_INTERVAL));
                if (this.i !== i || this.rpc?.client !== client) return;

                debugDiscord('RPC reconnecting, attempt %d', attempts + 1, client_id, i);
                try {
                    [id, client] = await findDiscordRpcClient(client_id, filter);
                    debugDiscord('RPC reconnected', i, id, client_id, client.application, client.user);

                    // @ts-expect-error
                    client.transport.on('close', reconnect);

                    this.rpc.client = client;
                    connected = true;
                    break;
                } catch (err) {
                    // debugDiscord('RPC reconnect failed, attempt %d', attempts + 1, i, clientid, err);
                }

                attempts++;
            }

            if (!connected) throw new Error('Failed to reconnect to Discord');

            this.onUpdateClient?.call(null, this.rpc.client);    
            this.rpc.client.setActivity(this.last_activity?.activity);
        };

        // @ts-expect-error
        client.transport.on('close', reconnect);

        this.rpc = {client: client!, id: client_id};
        this.onUpdateClient?.call(null, client!);

        return client!;
    }

    async onError(err: Error) {
        this.update_presence_errors++;

        if (this.update_presence_errors > 2) {
            // Disconnect from Discord if the last two attempts to update presence failed
            // This prevents the user's activity on Discord being stuck
            if (this.rpc) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            }

            this.title = null;
        }
    }
}

export class ZncDiscordPresence extends ZncNotifications {
    presence_user: string | null = null;
    discord_preconnect = false;
    show_friend_code = false;
    force_friend_code: CurrentUser['links']['friendCode'] | undefined = undefined;
    show_console_online = false;
    show_active_event = false;
    show_play_time = DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

    discord_client_filter: ((client: DiscordRpcClient, id?: number) => boolean) | undefined = undefined;

    readonly discord = new ZncDiscordPresenceClient(this);

    async init() {
        const {friends, user, activeevent} = await this.fetch([
            'announcements',
            this.presence_user ?
                this.presence_user === this.data.nsoAccount.user.nsaId ? 'user' :
                    {friend: this.presence_user} : null,
            this.presence_user && this.presence_user !== this.data.nsoAccount.user.nsaId &&
                this.show_active_event ? 'event' : null,
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        if (this.presence_user) {
            if (this.presence_user !== this.data.nsoAccount.user.nsaId) {
                const friend = friends!.find(f => f.nsaId === this.presence_user);

                if (!friend) {
                    throw new Error('User "' + this.presence_user + '" is not friends with this user');
                }

                await this.discord.updatePresenceForDiscord(friend.presence, friend);
            } else {
                await this.discord.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends, this.data.user.id, true);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);

        return LoopResult.OK;
    }

    get presence_enabled() {
        return !!this.presence_user;
    }

    async update() {
        const {friends, user, activeevent} = await this.fetch([
            this.presence_user ?
                this.presence_user === this.data.nsoAccount.user.nsaId ? 'user' :
                    {friend: this.presence_user} : null,
            this.presence_user && this.show_active_event ? 'event' : null,
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        if (this.presence_user) {
            if (this.presence_user !== this.data.nsoAccount.user.nsaId) {
                const friend = friends!.find(f => f.nsaId === this.presence_user);

                if (!friend) {
                    // Is the authenticated user no longer friends with this user?
                    await this.discord.updatePresenceForDiscord(null);
                } else {
                    await this.discord.updatePresenceForDiscord(friend.presence, friend);
                }
            } else {
                await this.discord.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends, this.data.user.id, false);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    async handleError(err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        this.discord.onError(err);

        return super.handleError(err);
    }
}

export class ZncProxyDiscordPresence extends Loop {
    splatnet2_monitors = new Map<string, EmbeddedSplatNet2Monitor | (() => Promise<EmbeddedSplatNet2Monitor>)>();

    readonly user_notifications = false;
    readonly friend_notifications = false;
    update_interval = 30;

    presence_user: null = null;
    discord_preconnect = false;
    show_friend_code = false;
    force_friend_code: CurrentUser['links']['friendCode'] | undefined = undefined;
    show_console_online = false;
    readonly show_active_event = false;
    show_play_time = DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

    discord_client_filter: ((client: DiscordRpcClient, id?: number) => boolean) | undefined = undefined;

    readonly discord = new ZncDiscordPresenceClient(this);

    constructor(
        public presence_url: string
    ) {
        super();
    }

    get presence_enabled() {
        return true;
    }

    async init() {
        await this.update();

        return LoopResult.OK;
    }

    async update() {
        const [presence, user] = await getPresenceFromUrl(this.presence_url);

        await this.discord.updatePresenceForDiscord(presence, user);
        await this.updatePresenceForSplatNet2Monitor(presence, this.presence_url);
    }

    async updatePresenceForSplatNet2Monitors(friends: (CurrentUser | Friend)[]) {
        for (const friend of friends) {
            await this.updatePresenceForSplatNet2Monitor(friend.presence, friend.nsaId, friend.name);
        }
    }

    async updatePresenceForSplatNet2Monitor(presence: Presence, nsa_id: string, name?: string) {
        const playing = presence.state === PresenceState.PLAYING;
        const monitor = this.splatnet2_monitors.get(nsa_id);

        if (playing && monitor) {
            const currenttitle = presence.game as Game;
            const titleid = getTitleIdFromEcUrl(currenttitle.shopUri);

            if (titleid && EmbeddedSplatNet2Monitor.title_ids.includes(titleid)) {
                if ('enable' in monitor) {
                    monitor.enable();
                    if (!monitor.enabled) debugSplatnet2('Started monitor for user %s', name ?? nsa_id);
                } else {
                    const m = await monitor.call(null);
                    this.splatnet2_monitors.set(nsa_id, m);
                    m.enable();
                    debugSplatnet2('Started monitor for user %s', name ?? nsa_id);
                }
            } else if ('disable' in monitor) {
                if (monitor.enabled) debugSplatnet2('Stopping monitor for user %s', name ?? nsa_id);
                monitor.disable();
            }
        } else if (monitor && 'disable' in monitor) {
            if (monitor.enabled) debugSplatnet2('Stopping monitor for user %s', name ?? nsa_id);
            monitor.disable();
        }
    }
}
