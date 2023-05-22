import { dialog, Notification } from './electron.js';
import createDebug from 'debug';
import { i18n } from 'i18next';
import { CurrentUser, Friend, Game, CoralErrorResponse } from '../../api/coral-types.js';
import { ErrorResponse } from '../../api/util.js';
import { ZncDiscordPresence, ZncProxyDiscordPresence } from '../../common/presence.js';
import { NotificationManager } from '../../common/notify.js';
import { LoopResult } from '../../util/loop.js';
import { tryGetNativeImageFromUrl } from './util.js';
import { App } from './index.js';
import { DiscordPresenceConfiguration, DiscordPresenceExternalMonitorsConfiguration, DiscordPresenceSource } from '../common/types.js';
import { DiscordPresence, DiscordPresencePlayTime, ErrorResult } from '../../discord/types.js';
import { DiscordRpcClient } from '../../discord/rpc.js';
import SplatNet3Monitor, { getConfigFromAppConfig as getSplatNet3MonitorConfigFromAppConfig } from '../../discord/monitor/splatoon3.js';

const debug = createDebug('app:main:monitor');

export class PresenceMonitorManager {
    monitors: (EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor)[] = [];
    notifications: NotificationManager;

    constructor(
        public app: App
    ) {
        this.notifications = new ElectronNotificationManager(app.i18n);
    }

    async start(id: string, callback?: (monitor: EmbeddedPresenceMonitor, firstRun: boolean) => Promise<void> | void) {
        debug('Starting monitor', id);

        const token = id.length === 16 ? await this.app.store.storage.getItem('NintendoAccountToken.' + id) : id;
        if (!token) throw new Error('No token for this user');

        const user = await this.app.store.users.get(token);

        const existing = this.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === user.data.user.id);
        if (existing) {
            await callback?.call(null, existing as EmbeddedPresenceMonitor, false);
            return existing;
        }

        const i = new EmbeddedPresenceMonitor(this.app.store.storage, token, user.nso, user.data, user);

        i.notifications = this.notifications;
        i.presence_user = null;
        i.user_notifications = false;
        i.friend_notifications = false;
        i.discord_preconnect = true;

        i.discord.onUpdateActivity = (presence: DiscordPresence | null) => {
            this.app.store.emit('update-discord-presence', presence ? {...presence, config: undefined} : null);
        };
        i.discord.onUpdateClient = (client: DiscordRpcClient | null) => {
            this.app.store.emit('update-discord-user', client?.user ?? null);
        };
        i.discord.onMonitorError = async (monitor, instance, err) => {
            const {response} = await dialog.showMessageBox({
                message: err.name + ' in external monitor ' + monitor.name,
                detail: err.stack ?? err.message,
                type: 'error',
                buttons: ['OK', 'Retry', 'Stop'],
                defaultId: 0,
            });

            if (response === 1) {
                return ErrorResult.RETRY;
            }
            if (response === 2) {
                return ErrorResult.STOP;
            }

            return ErrorResult.IGNORE;
        };

        i.onError = err => this.handleError(i, err);

        this.monitors.push(i);

        await callback?.call(null, i, true);

        i.enable();

        return i;
    }

    async startUrl(presence_url: string) {
        debug('Starting monitor', presence_url);

        const existing = this.monitors.find(m => m instanceof EmbeddedProxyPresenceMonitor && m.presence_url === presence_url);
        if (existing) return existing;

        const i = new EmbeddedProxyPresenceMonitor(presence_url);

        i.notifications = this.notifications;
        i.discord_preconnect = true;

        i.discord.onUpdateActivity = (presence: DiscordPresence | null) => {
            this.app.store.emit('update-discord-presence', presence ? {...presence, config: undefined} : null);
        };
        i.discord.onUpdateClient = (client: DiscordRpcClient | null) => {
            this.app.store.emit('update-discord-user', client?.user ?? null);
        };

        i.onError = err => this.handleError(i, err);

        this.monitors.push(i);

        i.enable();

        return i;
    }

    async stop(id: string) {
        let index;
        while ((index = this.monitors.findIndex(m =>
            (m instanceof EmbeddedPresenceMonitor && m.data.user.id === id) ||
            (m instanceof EmbeddedProxyPresenceMonitor && m.presence_url === id)
        )) >= 0) {
            const i = this.monitors[index];

            this.monitors.splice(index, 1);

            i.disable();

            if (i instanceof EmbeddedPresenceMonitor) this.notifications.removeAccount(id);
        }
    }

    getActiveDiscordPresenceMonitor() {
        return this.monitors.find(m => m.presence_enabled || m instanceof EmbeddedProxyPresenceMonitor);
    }

    getDiscordPresence(): DiscordPresence | null {
        const presence = this.getActiveDiscordPresenceMonitor()?.discord.last_activity;
        return presence && typeof presence === 'object' ? {...presence, config: undefined} : null;
    }

    getActiveDiscordPresenceOptions(): Omit<DiscordPresenceConfiguration, 'source'> | null {
        const monitor = this.getActiveDiscordPresenceMonitor();
        if (!monitor) return null;

        return {
            user: this.getDiscordClientFilterConfiguration(monitor.discord_client_filter),
            friend_code: monitor.show_friend_code && monitor.force_friend_code ?
                monitor.force_friend_code.id : undefined,
            show_console_online: monitor.show_console_online,
            show_active_event: monitor.show_active_event,
            show_play_time: monitor.show_play_time,
            monitors: this.getDiscordExternalMonitorConfiguration(monitor.discord.onWillStartMonitor),
        };
    }

    async setDiscordPresenceOptions(options: Omit<DiscordPresenceConfiguration, 'source'>) {
        const source = this.getDiscordPresenceSource();

        if (!source) {
            // Discord presence is not active
            // Save the presence options anyway so they can be restored when Discord presence is enabled
            return this.app.store.storage.setItem('AppDiscordPresenceOptions', options);
        }

        await this.setDiscordPresenceSource(source, monitor => {
            this.setDiscordPresenceConfigurationForMonitor(monitor, options);
            monitor.discord.refreshExternalMonitorsConfig();
            monitor.skipIntervalInCurrentLoop();
        });

        await this.app.store.saveMonitorState(this);
    }

    getDiscordPresenceConfiguration(): DiscordPresenceConfiguration | null {
        const source = this.getDiscordPresenceSource();
        const options = this.getActiveDiscordPresenceOptions();

        return source && options ? {source, ...options} : null;
    }

    async setDiscordPresenceConfiguration(config: DiscordPresenceConfiguration | null) {
        if (!config) return this.setDiscordPresenceSource(null);

        await this.setDiscordPresenceSource(config.source, monitor => {
            this.setDiscordPresenceConfigurationForMonitor(monitor, config);
            monitor.discord.refreshExternalMonitorsConfig();
            monitor.skipIntervalInCurrentLoop();
        });

        await this.app.store.saveMonitorState(this);
    }

    setDiscordPresenceConfigurationForMonitor(
        monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor,
        config: Omit<DiscordPresenceConfiguration, 'source'>
    ) {
        monitor.discord_client_filter = config.user ? this.createDiscordClientFilter(config.user) : undefined;
        monitor.show_friend_code = !!config.friend_code;
        monitor.force_friend_code = config.friend_code ?
            {id: config.friend_code, regenerable: false, regenerableAt: 0} : undefined;
        monitor.show_console_online = config.show_console_online ?? false;
        if (monitor instanceof ZncDiscordPresence) monitor.show_active_event = config.show_active_event ?? false;
        monitor.show_play_time = config.show_play_time ?? DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE;
        monitor.discord.onWillStartMonitor = config.monitors ?
            this.createDiscordExternalMonitorHandler(monitor, config.monitors) : null;
    }

    private discord_client_filter_config = new WeakMap<
        Exclude<ZncDiscordPresence['discord_client_filter'], undefined>,
        /** Discord user ID */
        string
    >();

    createDiscordClientFilter(user: string) {
        const filter: ZncDiscordPresence['discord_client_filter'] = (client, id) => client.user?.id === user;
        this.discord_client_filter_config.set(filter, user);
        return filter;
    }

    getDiscordClientFilterConfiguration(filter: ZncDiscordPresence['discord_client_filter']) {
        return filter ? this.discord_client_filter_config.get(filter) : undefined;
    }

    private discord_external_monitor_config = new WeakMap<
        Exclude<ZncDiscordPresence['discord']['onWillStartMonitor'], null>,
        DiscordPresenceExternalMonitorsConfiguration
    >();

    createDiscordExternalMonitorHandler(
        presence_monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor,
        config: DiscordPresenceExternalMonitorsConfiguration
    ) {
        const handler: ZncDiscordPresence['discord']['onWillStartMonitor'] = monitor => {
            if (!(presence_monitor instanceof EmbeddedPresenceMonitor)) return null;
            const {storage, token} = presence_monitor;
            if (monitor === SplatNet3Monitor) return getSplatNet3MonitorConfigFromAppConfig(config, storage, token);
            return null;
        };
        this.discord_external_monitor_config.set(handler, config);
        return handler;
    }

    getDiscordExternalMonitorConfiguration(handler: ZncDiscordPresence['discord']['onWillStartMonitor']) {
        return handler ? this.discord_external_monitor_config.get(handler) : undefined;
    }

    getDiscordPresenceSource(): DiscordPresenceSource | null {
        const monitor = this.getActiveDiscordPresenceMonitor();
        if (!monitor) return null;

        return monitor instanceof EmbeddedProxyPresenceMonitor ? {
            url: monitor.presence_url,
        } : {
            na_id: monitor.data.user.id,
            friend_nsa_id: monitor.presence_user === monitor.data.nsoAccount.user.nsaId ? undefined :
                monitor.presence_user ?? undefined,
        };
    }

    async setDiscordPresenceSource(
        source: DiscordPresenceSource | null,
        callback?: (monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor) => void
    ) {
        const existing = this.getActiveDiscordPresenceMonitor();

        if (source && 'na_id' in source &&
            existing && existing instanceof EmbeddedPresenceMonitor &&
            existing.data.user.id === source.na_id &&
            existing.presence_user !== (source.friend_nsa_id ?? existing.data.nsoAccount.user.nsaId)
        ) {
            await this.start(source.na_id, monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId;
                this.setDiscordPresenceSourceCopyConfiguration(monitor, existing);
                callback?.call(null, monitor);
                monitor.discord.refreshExternalMonitorsConfig();
                monitor.skipIntervalInCurrentLoop();
            });
            this.app.store.saveMonitorState(this);
            this.app.menu?.updateMenu();
            return;
        }

        if (existing) {
            if (source && (
                ('na_id' in source && existing instanceof EmbeddedPresenceMonitor && existing.data.user.id === source.na_id) ||
                ('url' in source && existing instanceof EmbeddedProxyPresenceMonitor && existing.presence_url === source.url)
            )) {
                callback?.call(null, existing);
                return;
            }

            existing.discord.updatePresenceForDiscord(null);

            if (existing instanceof EmbeddedPresenceMonitor) {
                existing.presence_user = null;

                if (!existing.user_notifications && !existing.friend_notifications) {
                    this.stop(existing.data.user.id);
                }
            }

            if (existing instanceof EmbeddedProxyPresenceMonitor) {
                this.stop(existing.presence_url);
            }
        }

        if (source && 'na_id' in source) {
            await this.start(source.na_id, async monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId;
                if (existing) this.setDiscordPresenceSourceCopyConfiguration(monitor, existing);
                else await this.setDiscordPresenceSourceRestoreSavedConfiguration(monitor);
                callback?.call(null, monitor);
                monitor.discord.refreshExternalMonitorsConfig();
                monitor.skipIntervalInCurrentLoop();
            });
        } else if (source && 'url' in source) {
            const monitor = await this.startUrl(source.url);
            if (existing) this.setDiscordPresenceSourceCopyConfiguration(monitor, existing);
            else await this.setDiscordPresenceSourceRestoreSavedConfiguration(monitor);
            callback?.call(null, monitor);
        }

        if (existing || source) {
            this.app.store.saveMonitorState(this);
            this.app.menu?.updateMenu();
            this.app.store.emit('update-discord-presence-source', source);
        }
    }

    private async setDiscordPresenceSourceRestoreSavedConfiguration(
        monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor
    ) {
        const config: Omit<DiscordPresenceConfiguration, 'source'> | undefined =
            await this.app.store.storage.getItem('AppDiscordPresenceOptions');

        if (!config) return;
        this.setDiscordPresenceConfigurationForMonitor(monitor, config);
    }

    private setDiscordPresenceSourceCopyConfiguration(
        monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor,
        existing: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor,
    ) {
        monitor.discord_client_filter = existing.discord_client_filter;
        monitor.show_friend_code = existing.show_friend_code && !!existing.force_friend_code;
        monitor.force_friend_code = existing.force_friend_code;
        monitor.show_console_online = existing.show_console_online;
        if (monitor instanceof ZncDiscordPresence) monitor.show_active_event = existing.show_active_event;
        monitor.show_play_time = existing.show_play_time;
        monitor.discord.onWillStartMonitor = existing.discord.onWillStartMonitor;
    }

    async handleError(
        monitor: EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor,
        err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException
    ): Promise<LoopResult> {
        const {response} = await dialog.showMessageBox({
            message: err.name + ' updating presence monitor',
            detail: err.stack ?? err.message,
            type: 'error',
            buttons: ['OK', 'Retry'],
            defaultId: 0,
        });

        if (response === 1) {
            return LoopResult.OK_SKIP_INTERVAL;
        }

        return LoopResult.OK;
    }
}

export class EmbeddedPresenceMonitor extends ZncDiscordPresence {
    onError?: (error: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException) =>
        Promise<LoopResult | void> | LoopResult | void = undefined;

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
        this.skipIntervalInCurrentLoop();
    }

    get enabled() {
        return this._running !== 0;
    }

    private _running = 0;

    private async _run() {
        this._running++;
        const i = this._running;

        try {
            await this.loop(true);

            while (i === this._running) {
                await this.loop();
            }

            if (this._running === 0 && !this.onStop) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

            await this.onStop?.();

            debug('Monitor for user %s finished', this.data.nsoAccount.user.name);
        } finally {
            this._running = 0;
        }
    }

    async handleError(err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        try {
            return await super.handleError(err);
        } catch (err: any) {
            return await this.onError?.call(null, err) ?? LoopResult.OK;
        }
    }

    skipIntervalInCurrentLoop(start = false) {
        super.skipIntervalInCurrentLoop();
        if (!this._running && start) this.enable();
    }
}

export class EmbeddedProxyPresenceMonitor extends ZncProxyDiscordPresence {
    notifications: NotificationManager | null = null;
    onError?: (error: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException) =>
        Promise<LoopResult | void> | LoopResult | void = undefined;

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
        this.skipIntervalInCurrentLoop();
    }

    get enabled() {
        return this._running !== 0;
    }

    private _running = 0;

    private async _run() {
        this._running++;
        const i = this._running;

        try {
            await this.loop(true);

            while (i === this._running) {
                await this.loop();
            }

            if (this._running === 0 && !this.onStop) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

            await this.onStop?.();

            debug('Monitor for presence URL %s finished', this.presence_url);
        } finally {
            this._running = 0;
        }
    }

    async handleError(err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        try {
            return await super.handleError(err);
        } catch (err: any) {
            return await this.onError?.call(null, err) ?? LoopResult.OK;
        }
    }

    skipIntervalInCurrentLoop(start = false) {
        super.skipIntervalInCurrentLoop();
        if (!this._running && start) this.enable();
    }
}

export class ElectronNotificationManager extends NotificationManager {
    t: ReturnType<i18n['getFixedT']>;

    constructor(i18n: i18n) {
        super();

        this.t = i18n.getFixedT(null, 'notifications');
    }

    async onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        new Notification({
            title: friend.name,
            body: this.t('offline')!,
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }
}
