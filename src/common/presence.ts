import createDebug from 'debug';
import EventSource from 'eventsource';
import { DiscordRpcClient, findDiscordRpcClient } from '../discord/rpc.js';
import { getDiscordPresence, getInactiveDiscordPresence } from '../discord/util.js';
import { DiscordPresencePlayTime, DiscordPresenceContext, DiscordPresence, ExternalMonitorConstructor, ExternalMonitor, ErrorResult } from '../discord/types.js';
import { EmbeddedSplatNet2Monitor, handleError, ZncNotifications } from './notify.js';
import { getPresenceFromUrl } from '../api/znc-proxy.js';
import { ActiveEvent, CurrentUser, Friend, Game, Presence, PresenceState, CoralErrorResponse } from '../api/coral-types.js';
import { ErrorResponse, ResponseSymbol } from '../api/util.js';
import Loop, { LoopResult } from '../util/loop.js';
import { getTitleIdFromEcUrl } from '../index.js';
import { parseLinkHeader } from '../util/http.js';
import { getUserAgent } from '../util/useragent.js';

const debug = createDebug('nxapi:nso:presence');
const debugEventStream = createDebug('nxapi:nso:presence:sse');
const debugDiscord = createDebug('nxapi:nso:presence:discordrpc');
const debugSplatnet2 = createDebug('nxapi:nso:presence:splatnet2');

const MAX_CONNECT_ATTEMPTS = Infinity; // 10
const RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_PROXY_AUTO_RETRY = 10;

interface SavedPresence {
    presence: Presence;
    title_since: number;
    created_at: number;
}

class ZncDiscordPresenceClient {
    rpc: {client: DiscordRpcClient, id: string} | null = null;
    title: {id: string; since: number} | null = null;
    monitors = new Map<ExternalMonitorConstructor<any>, ExternalMonitor>();
    protected i = 0;

    last_presence: Presence | null = null;
    last_user: CurrentUser | Friend | undefined = undefined;
    last_friendcode: CurrentUser['links']['friendCode'] | undefined = undefined;
    last_event: ActiveEvent | undefined = undefined;

    last_activity: DiscordPresence | string | null = null;
    onUpdateActivity: ((activity: DiscordPresence | null) => void) | null = null;
    onUpdateClient: ((client: DiscordRpcClient | null) => void) | null = null;
    onWillStartMonitor: (<T>(monitor: ExternalMonitorConstructor<T>) => any | T | null | Promise<T | null>) | null = null;
    onMonitorError: ((monitor: ExternalMonitorConstructor, instance: ExternalMonitor, error: Error) =>
        ErrorResult | Promise<ErrorResult>) | null = null;

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
            for (const [monitor, instance] of this.monitors.entries()) {
                debug('Stopping monitor %s', monitor.name);
                instance.disable();
                this.monitors.delete(monitor);
            }

            if (this.m.presence_enabled && this.m.discord_preconnect) {
                if (this.rpc) {
                    debugDiscord('No presence but Discord preconnect enabled - clearing Discord activity');
                    this.setActivity(this.rpc.id);
                } else {
                    debugDiscord('No presence but Discord preconnect enabled - connecting');
                    const discordpresence = getInactiveDiscordPresence(PresenceState.OFFLINE, 0);
                    this.setActivity(discordpresence.id);
                }

                return;
            }

            this.setActivity(null);
            this.title = null;
            return;
        }

        const presence_context: DiscordPresenceContext = {
            friendcode: this.m.show_friend_code ? this.m.force_friend_code ?? friendcode : undefined,
            activeevent: this.m.show_active_event ? activeevent : undefined,
            show_play_time: this.m.show_play_time,
            znc_discord_presence: this.m,
            proxy_response: (this.m) instanceof ZncProxyDiscordPresence ? this.m.last_data : undefined,
            monitors: [...this.monitors.values()],
            nsaid: this.m.presence_user!,
            user,
        };

        const discord_presence = 'name' in presence.game ?
            getDiscordPresence(presence.state, presence.game, presence_context) :
            getInactiveDiscordPresence(presence.state, presence.logoutAt, presence_context);

        const prev_title = this.title;

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

        const monitors = discord_presence.config?.monitor ? [discord_presence.config.monitor] : [];
        this.updateExternalMonitors(monitors, 'name' in presence.game ? presence.game : undefined,
            prev_title?.id, this.title?.id);

        this.setActivity(discord_presence);
    }

    async updateExternalMonitors(monitors: ExternalMonitorConstructor[], game?: Game, prev_title?: string, new_title?: string) {
        for (const monitor of monitors) {
            const instance = this.monitors.get(monitor);

            if (instance) {
                if (prev_title !== new_title) {
                    instance.onChangeTitle?.(game);
                }
            } else {
                const config = await this.getExternalMonitorConfig(monitor);
                debug('Starting monitor %s', monitor.name, config);

                const i = new ExternalMonitorPresenceInterface(monitor, this.m);
                const instance = new monitor(i, config, game);
                Object.assign(i, {instance});
                this.monitors.set(monitor, instance);
                instance.enable();
            }
        }

        for (const [monitor, instance] of this.monitors.entries()) {
            if (monitors.includes(monitor)) continue;

            debug('Stopping monitor %s', monitor.name);
            instance.disable();
            this.monitors.delete(monitor);
        }
    }

    async getExternalMonitorConfig(monitor: ExternalMonitorConstructor) {
        return this.onWillStartMonitor?.call(null, monitor) ?? null;
    }

    async refreshExternalMonitorsConfig() {
        for (const [monitor, instance] of this.monitors.entries()) {
            const config = await this.getExternalMonitorConfig(monitor);
            await this.updateExternalMonitorConfig(monitor, config);
        }
    }

    async updateExternalMonitorConfig<T>(monitor: ExternalMonitorConstructor<T>, config: T) {
        const instance = this.monitors.get(monitor);
        if (!instance) return;

        debug('Updating monitor %s config', monitor.name, config);

        try {
            if (await instance.onUpdateConfig?.(config)) {
                debug('Updated monitor %s config', monitor.name);
            } else {
                await this.forceRestartMonitor(monitor, config /* , game */);
            }
        } catch (err) {
            await this.forceRestartMonitor(monitor, config /* , game */);
        }
    }

    async forceRestartMonitor<T>(monitor: ExternalMonitorConstructor<T>, config: T, game?: Game) {
        const existing = this.monitors.get(monitor);
        if (!existing) return;

        debug('Restarting monitor %s', monitor.name);

        existing.disable();

        const i = new ExternalMonitorPresenceInterface(monitor, this.m);
        const instance = new monitor(i, config, game);
        Object.assign(i, {instance});
        this.monitors.set(monitor, instance);
        instance.enable();
    }

    async setActivity(activity: DiscordPresence | string | null) {
        this.onUpdateActivity?.call(null, typeof activity === 'string' ? null : activity);
        this.last_activity = activity;

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
            if (this.i !== i || client!) return;

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
            this.setActivity(this.last_activity);
        };

        // @ts-expect-error
        client.transport.on('close', reconnect);

        if (this.rpc) {
            // Another client connected first
            client!.destroy();
            return (this.rpc as {client: DiscordRpcClient}).client;
        }

        this.rpc = {client: client!, id: client_id};
        this.onUpdateClient?.call(null, client!);
        this.setActivity(this.last_activity);

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
        }

        if (this.update_presence_errors > 10) {
            this.title = null;
        }
    }

    refreshPresence() {
        this.updatePresenceForDiscord(
            this.last_presence,
            this.last_user,
            this.last_friendcode,
            this.last_event,
        );
    }
}

export class ExternalMonitorPresenceInterface {
    readonly instance!: ExternalMonitor;

    constructor(
        readonly monitor: ExternalMonitorConstructor<any>,
        readonly znc_discord_presence: ZncDiscordPresence | ZncProxyDiscordPresence,
    ) {}

    refreshPresence() {
        this.znc_discord_presence.discord.refreshPresence();
    }

    async handleError(err: Error) {
        debug('Error in external monitor %s', this.monitor.name, err);

        if (this.znc_discord_presence.discord.onMonitorError) {
            return await this.znc_discord_presence.discord.onMonitorError.call(null, this.monitor, this.instance, err);
        } else {
            return ErrorResult.STOP;
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

                await this.restorePresenceForTitleUpdateAt(friend.nsaId, friend.presence);

                await this.discord.updatePresenceForDiscord(friend.presence, friend);
                await this.savePresenceForTitleUpdateAt(friend.nsaId, friend.presence, this.discord.title?.since);
            } else {
                await this.restorePresenceForTitleUpdateAt(user!.nsaId, user!.presence);

                await this.discord.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
                await this.savePresenceForTitleUpdateAt(user!.nsaId, user!.presence, this.discord.title?.since);
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
                    await this.savePresenceForTitleUpdateAt(friend.nsaId, friend.presence, this.discord.title?.since);
                }
            } else {
                await this.discord.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
                await this.savePresenceForTitleUpdateAt(user!.nsaId, user!.presence, this.discord.title?.since);
            }
        }

        await this.updatePresenceForNotifications(user, friends, this.data.user.id, false);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    async onStop() {
        await this.discord.setActivity(null);
    }

    saved_presence = new Map<string, number>();

    async savePresenceForTitleUpdateAt(id: string, presence: Presence, title_since = Date.now()) {
        if (this.saved_presence.get(id) === presence.updatedAt) return;

        const saved_presence: SavedPresence = {
            presence,
            title_since,
            created_at: Date.now(),
        };

        await this.storage.setItem('LastPresence.' + id, saved_presence);
        this.saved_presence.set(id, presence.updatedAt);
    }

    async restorePresenceForTitleUpdateAt(id: string, presence: Presence) {
        const saved_presence: SavedPresence | undefined = await this.storage.getItem('LastPresence.' + id);
        if (!saved_presence) return;

        if (saved_presence.presence.updatedAt !== presence.updatedAt) return;
        if (!('name' in presence.game)) return;

        const title_id = getTitleIdFromEcUrl(presence.game.shopUri);
        if (!title_id) return;
        if (!('name' in saved_presence.presence.game) ||
            getTitleIdFromEcUrl(saved_presence.presence.game.shopUri) !== title_id) return;

        this.discord.title = {id: title_id, since: saved_presence.title_since};
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

    is_first_request = true;
    is_sse = false;
    eventstream_url: string | null = null;

    last_data: unknown | null = null;

    constructor(
        public presence_url: string
    ) {
        super();
    }

    get presence_enabled() {
        return true;
    }

    async init() {
        return await this.update() ?? LoopResult.OK;
    }

    protected proxy_temporary_errors = 0;

    async update() {
        if (this.is_sse) {
            return await this.useEventStream();
        }

        try {
            const result = await getPresenceFromUrl(this.presence_url);
            const [presence, user, data] = result;
            this.last_data = data;
            this.proxy_temporary_errors = 0;

            await this.discord.updatePresenceForDiscord(presence, user);
            await this.updatePresenceForSplatNet2Monitor(presence, this.presence_url);

            if (this.is_first_request) {
                const link_header = result[ResponseSymbol].headers.get('Link');
                const links = link_header ? parseLinkHeader(link_header) : [];
                debug('presence links', links);
                const eventstream_link = links.find(l => l.rel.includes('alternate') && l.type === 'text/event-stream');

                if (eventstream_link) {
                    this.eventstream_url = new URL(eventstream_link.uri, this.presence_url).href;
                    this.is_sse = true;
                    debug('Presence URL included server-sent events link, switching now', this.eventstream_url);
                }

                this.is_first_request = false;

                // Connect to the event stream immediately
                if (eventstream_link) return LoopResult.OK_SKIP_INTERVAL;
            }
        } catch (err) {
            if (err instanceof ErrorResponse) {
                if (err.response.headers.get('Content-Type')?.match(/^text\/event-stream(;|$)/)) {
                    this.is_sse = true;
                    debug('Presence URL responded with an event stream');
                    return LoopResult.OK_SKIP_INTERVAL;
                }

                const retry_after = err.response.headers.get('Retry-After');
                if (!retry_after || !/^\d+$/.test(retry_after)) throw err;

                debug('Received error response - suggests waiting %ds before retrying', retry_after, err.data);

                this.proxy_temporary_errors++;
                if (this.proxy_temporary_errors > MAX_PROXY_AUTO_RETRY) throw err;

                // Still report the error to ZncDiscordPresenceClient to prevent presence being stuck
                // on repeated errors
                this.discord.onError(err);

                await new Promise(rs => setTimeout(this.timeout_resolve = rs, parseInt(retry_after) * 1000));

                return LoopResult.OK_SKIP_INTERVAL;
            }

            throw err;
        }
    }

    events: EventSource | null = null;

    useEventStream() {
        if (this.events) this.events.close();

        const events = new EventSource(this.eventstream_url ?? this.presence_url, {
            headers: {
                'User-Agent': getUserAgent(),
            },
        });

        this.events = events;

        let timeout: NodeJS.Timeout;
        let timeout_interval = 90000;
        const ontimeout = () => events.dispatchEvent({type: 'error', message: 'Timeout'} as any);

        events.onopen = event => {
            debugEventStream('EventSource connected', event);
            timeout = setTimeout(ontimeout, timeout_interval);
        };

        let user: CurrentUser | Friend | undefined = undefined;
        let presence: Presence | null = null;
        let supported_events: readonly string[] = ['friend'];

        this.last_data = {};

        const onmessage = (event: MessageEvent) => {
            clearTimeout(timeout);
            timeout = setTimeout(ontimeout, timeout_interval);

            if (event.type === 'message') {
                debugEventStream('Received debug message', event.data);
                return;
            }
            if (event.type === 'update') {
                debugEventStream('Received presence updated message', event.data);
                return;
            }
            if (event.type === 'supported_events') {
                const new_supported_events: readonly string[] = (JSON.parse(event.data) as readonly string[])
                    .filter(e => e !== 'open' && e !== 'error' &&
                        e !== 'message' && e !== 'update' &&
                        e !== 'supported_events');
                debugEventStream('Received supported events message', new_supported_events);

                for (const type of supported_events) {
                    events.removeEventListener(type, onmessage);
                }
                for (const type of new_supported_events) {
                    events.addEventListener(type, onmessage);
                }
                supported_events = new_supported_events;

                return;
            }

            const data = JSON.parse(event.data);
            debugEventStream('Received updated %s data', event.type, data);

            Object.assign(this.last_data!, {[event.type]: data});

            if (event.type === 'user' || event.type === 'friend') {
                user = data;
                presence = data.presence;
            }
            if (event.type === 'presence') {
                presence = data;
            }

            if (presence) {
                this.discord.updatePresenceForDiscord(presence, user);
                this.updatePresenceForSplatNet2Monitor(presence, this.presence_url);
            }
        };

        events.onmessage = onmessage;
        events.addEventListener('supported_events', onmessage);
        events.addEventListener('update', onmessage);
        events.addEventListener('friend', onmessage);

        return new Promise<void>((rs, rj) => {
            this.timeout_resolve = () => {
                debugEventStream('Update interval cancelled, closing event stream');
                events.close();
                rs();
            };

            events.onerror = event => {
                debugEventStream('EventSource error', event);
                events.close();

                if ((event as any).message) {
                    const err = new Error((event as any).message);
                    Object.assign(err, event);
                    rj(err);
                } else {
                    // No error message
                    rs();
                }
            };
        });
    }

    async onStop() {
        await this.discord.setActivity(null);
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

    async handleError(err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        this.discord.onError(err);

        return handleError(err, this);
    }
}
