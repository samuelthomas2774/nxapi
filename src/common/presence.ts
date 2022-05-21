import createDebug from 'debug';
import { DiscordRpcClient, findDiscordRpcClient } from '../discord/rpc.js';
import { DiscordPresencePlayTime, DiscordPresenceContext, getDiscordPresence, getInactiveDiscordPresence } from '../discord/util.js';
import { ZncNotifications } from './notify.js';
import { getPresenceFromUrl } from '../api/znc-proxy.js';
import { ActiveEvent, CurrentUser, Friend, Presence, PresenceState, ZncErrorResponse } from '../api/znc-types.js';
import { ErrorResponse } from '../api/util.js';
import { LoopResult } from '../util/loop.js';

const debug = createDebug('nxapi:nso:presence');
const debugProxy = createDebug('nxapi:nso:presence:proxy');
const debugDiscord = createDebug('nxapi:nso:presence:discordrpc');

export class ZncDiscordPresence extends ZncNotifications {
    presence_user: string | null = null;
    discord_preconnect = false;
    show_friend_code = false;
    force_friend_code: CurrentUser['links']['friendCode'] | undefined = undefined;
    show_console_online = false;
    show_active_event = true;
    show_play_time = DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;

    async init() {
        const {friends, user, activeevent} = await this.fetch([
            'announcements',
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
                    throw new Error('User "' + this.presence_user + '" is not friends with this user');
                }

                await this.updatePresenceForDiscord(friend.presence, friend);
            } else {
                await this.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);

        return LoopResult.OK;
    }

    get presence_enabled() {
        return !!this.presence_user;
    }

    rpc: {client: DiscordRpcClient, id: string} | null = null;
    discord_client_filter: ((client: DiscordRpcClient, id?: number) => boolean) | undefined = undefined;
    title: {id: string; since: number} | null = null;
    i = 0;

    last_presence: Presence | null = null;
    last_user: CurrentUser | Friend | undefined = undefined;
    last_friendcode: CurrentUser['links']['friendCode'] | undefined = undefined;
    last_event: ActiveEvent | undefined = undefined;

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
            (this.show_console_online && presence?.state === PresenceState.INACTIVE);

        if (this.rpc && this.discord_client_filter && !this.discord_client_filter.call(null, this.rpc.client)) {
            const client = this.rpc.client;
            this.rpc = null;
            await client.destroy();
        }

        if (!presence || !show_presence) {
            if (this.presence_enabled && this.discord_preconnect && !this.rpc) {
                debugDiscord('No presence but Discord preconnect enabled - connecting');
                const discordpresence = getInactiveDiscordPresence(PresenceState.OFFLINE, 0);
                const client = await this.createDiscordClient(discordpresence.id, this.discord_client_filter);
                this.rpc = {client, id: discordpresence.id};
                return;
            }

            if (this.rpc && !(this.presence_enabled && this.discord_preconnect)) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            } else if (this.rpc && this.title) {
                debugDiscord('No presence but Discord preconnect enabled - clearing Discord activity');
                await this.rpc.client.clearActivity();
            }

            this.title = null;
            return;
        }

        const presencecontext: DiscordPresenceContext = {
            friendcode: this.show_friend_code ? this.force_friend_code ?? friendcode : undefined,
            activeevent: this.show_active_event ? activeevent : undefined,
            show_play_time: this.show_play_time,
            znc_discord_presence: this,
            nsaid: this.presence_user!,
            user,
        };

        const discordpresence = 'name' in presence.game ?
            getDiscordPresence(presence.state, presence.game, presencecontext) :
            getInactiveDiscordPresence(presence.state, presence.logoutAt, presencecontext);

        if (this.rpc && this.rpc.id !== discordpresence.id) {
            const client = this.rpc.client;
            this.rpc = null;
            await client.destroy();
        }

        if (!this.rpc) {
            const client = await this.createDiscordClient(discordpresence.id, this.discord_client_filter);
            this.rpc = {client, id: discordpresence.id};
        }

        if (discordpresence.title) {
            if (discordpresence.title !== this.title?.id) {
                // Use the timestamp the user's presence was last updated according to Nintendo
                // This may be incorrect as this will also change when the state/description changes in the
                // same title, but this shouldn't matter unless the process is restarted or presence tracking
                // is reset for some other reason (e.g. using the Electron app)
                const since = Math.min(presence.updatedAt * 1000, Date.now());

                this.title = {id: discordpresence.title, since};
            }

            if (discordpresence.showTimestamp) {
                discordpresence.activity.startTimestamp = this.title.since;
            }
        } else {
            this.title = null;
        }

        this.rpc.client.setActivity(discordpresence.activity);

        this.update_presence_errors = 0;
    }

    async createDiscordClient(
        clientid: string,
        filter = (client: DiscordRpcClient, id: number) => true
    ) {
        let client: DiscordRpcClient;
        let attempts = 0;
        let connected = false;
        let id;

        while (attempts < 10) {
            if (attempts === 0) debugDiscord('RPC connecting', clientid);
            else debugDiscord('RPC connecting, attempt %d', attempts + 1, clientid);

            try {
                [id, client] = await findDiscordRpcClient(clientid, filter);
                debugDiscord('RPC connected', id, clientid, client.application, client.user);
                connected = true;
                break;
            } catch (err) {}

            attempts++;
            await new Promise(rs => setTimeout(rs, 5000));
        }

        if (!connected) throw new Error('Failed to connect to Discord');

        const reconnect = async () => {
            if (this.rpc?.client !== client) return;

            debugDiscord('RPC client disconnected, attempting to reconnect', clientid);
            let attempts = 0;
            let connected = false;

            while (attempts < 10) {
                if (this.rpc?.client !== client) return;

                debugDiscord('RPC reconnecting, attempt %d', attempts + 1, clientid);
                try {
                    [id, client] = await findDiscordRpcClient(clientid, filter);
                    debugDiscord('RPC reconnected', id, clientid, client.application, client.user);

                    // @ts-expect-error
                    client.transport.on('close', reconnect);

                    this.rpc.client = client;
                    connected = true;
                    break;
                } catch (err) {
                    debugDiscord('RPC reconnect failed, attempt %d', attempts + 1, clientid, err);
                }

                attempts++;
                await new Promise(rs => setTimeout(rs, 5000));
            }

            if (!connected) throw new Error('Failed to reconnect to Discord');
        };

        // @ts-expect-error
        client.transport.on('close', reconnect);

        return client!;
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
                    await this.updatePresenceForDiscord(null);
                } else {
                    await this.updatePresenceForDiscord(friend.presence, friend);
                }
            } else {
                await this.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    update_presence_errors = 0;

    async handleError(err: ErrorResponse<ZncErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
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

        return super.handleError(err);
    }
}

export class ZncProxyDiscordPresence extends ZncDiscordPresence {
    constructor(
        public presence_url: string
    ) {
        super(null!, null!, null!, null!);
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

        await this.updatePresenceForDiscord(presence, user);
        await this.updatePresenceForSplatNet2Monitor(presence, this.presence_url);
    }
}
