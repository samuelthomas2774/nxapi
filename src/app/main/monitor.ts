import { Notification } from 'electron';
import { i18n } from 'i18next';
import { LocalStorage } from 'node-persist';
import { App } from './index.js';
import { showErrorDialog, tryGetNativeImageFromUrl } from './util.js';
import { DiscordPresenceConfiguration, DiscordPresenceExternalMonitorsConfiguration, DiscordPresenceSource, DiscordStatus } from '../common/types.js';
import { CurrentUser, Friend, CoralError, PresenceGame } from '../../api/coral-types.js';
import { ErrorResponse } from '../../api/util.js';
import { ZncDiscordPresence, ZncProxyDiscordPresence } from '../../common/presence.js';
import { NotificationManager } from '../../common/notify.js';
import createDebug from '../../util/debug.js';
import { LoopResult } from '../../util/loop.js';
import { DiscordPresence, DiscordPresencePlayTime, ErrorResult } from '../../discord/types.js';
import { DiscordRpcClient } from '../../discord/rpc.js';
import SplatNet3Monitor, { getConfigFromAppConfig as getSplatNet3MonitorConfigFromAppConfig } from '../../discord/monitor/splatoon3.js';
import { ErrorDescription } from '../../util/errors.js';
import { CoralApiInterface, CoralErrorResponse } from '../../api/coral.js';
import { NintendoAccountAuthErrorResponse, NintendoAccountErrorResponse } from '../../api/na.js';
import { InvalidNintendoAccountTokenError } from '../../common/auth/na.js';
import { CoralUser } from '../../common/users.js';

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

        const existing = this.monitors.find(m => m instanceof EmbeddedPresenceMonitor &&
            m.user.data.user.id === user.data.user.id);

        if (existing) {
            await callback?.call(null, existing as EmbeddedPresenceMonitor, false);
            return existing;
        }

        const i = new EmbeddedPresenceMonitor(user, this.app.store.storage, token);

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
            const {response} = await showErrorDialog({
                message: err.name + ' in external monitor ' + monitor.name,
                error: err,
                buttons: ['OK', 'Retry', 'Stop'],
                defaultId: 0,
                app: this.app,
            });

            if (response === 1) {
                return ErrorResult.RETRY;
            }
            if (response === 2) {
                return ErrorResult.STOP;
            }

            return ErrorResult.IGNORE;
        };

        i.discord.onUpdateError = err => {
            const status: DiscordStatus = {
                error_message: err instanceof Error ?
                    err.name + ': ' + err.message :
                    ErrorDescription.getErrorDescription(err),
            };
            this.app.store.emit('update-discord-status', status);
        };
        i.discord.onUpdateSuccess = () => {
            const status: DiscordStatus = {error_message: null};
            this.app.store.emit('update-discord-status', status);
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

        i.status_updates = this.app.statusupdates;
        i.notifications = this.notifications;
        i.discord_preconnect = true;

        i.discord.onUpdateActivity = (presence: DiscordPresence | null) => {
            this.app.store.emit('update-discord-presence', presence ? {...presence, config: undefined} : null);
        };
        i.discord.onUpdateClient = (client: DiscordRpcClient | null) => {
            this.app.store.emit('update-discord-user', client?.user ?? null);
        };

        i.discord.onUpdateError = err => {
            const status: DiscordStatus = {
                error_message: err instanceof Error ?
                    err.name + ': ' + err.message :
                    ErrorDescription.getErrorDescription(err),
            };
            this.app.store.emit('update-discord-status', status);
        };
        i.discord.onUpdateSuccess = () => {
            const status: DiscordStatus = {error_message: null};
            this.app.store.emit('update-discord-status', status);
        };

        i.onError = err => this.handleError(i, err);

        this.monitors.push(i);

        i.enable();

        return i;
    }

    async stop(id: string) {
        let index;
        while ((index = this.monitors.findIndex(m =>
            (m instanceof EmbeddedPresenceMonitor && m.user.data.user.id === id) ||
            (m instanceof EmbeddedProxyPresenceMonitor && m.presence_url === id)
        )) >= 0) {
            const i = this.monitors[index];

            this.monitors.splice(index, 1);

            i.disable();

            if (i instanceof EmbeddedPresenceMonitor) this.notifications.removeAccount(id);

            if (i instanceof EmbeddedProxyPresenceMonitor) {
                i.status_update_source?.cancel();
                i.status_update_source = null;
            }
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
            na_id: monitor.user.data.user.id,
            friend_nsa_id: monitor.presence_user === monitor.user.data.nsoAccount.user.nsaId ? undefined :
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
            existing.user.data.user.id === source.na_id &&
            existing.presence_user !== (source.friend_nsa_id ?? existing.user.data.nsoAccount.user.nsaId)
        ) {
            await this.start(source.na_id, monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.user.data.nsoAccount.user.nsaId;
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
                ('na_id' in source && existing instanceof EmbeddedPresenceMonitor && existing.user.data.user.id === source.na_id) ||
                ('url' in source && existing instanceof EmbeddedProxyPresenceMonitor && existing.presence_url === source.url)
            )) {
                callback?.call(null, existing);
                return;
            }

            existing.discord.updatePresenceForDiscord(null);

            if (existing instanceof EmbeddedPresenceMonitor) {
                existing.presence_user = null;

                if (!existing.user_notifications && !existing.friend_notifications) {
                    this.stop(existing.user.data.user.id);
                }
            }

            if (existing instanceof EmbeddedProxyPresenceMonitor) {
                this.stop(existing.presence_url);
            }
        }

        if (source && 'na_id' in source) {
            await this.start(source.na_id, async monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.user.data.nsoAccount.user.nsaId;
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
        } else {
            this.app.store.emit('update-discord-status', null);
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
        err: ErrorResponse<CoralError> | NodeJS.ErrnoException
    ): Promise<LoopResult> {
        if (monitor instanceof EmbeddedProxyPresenceMonitor || checkShouldIgnorePresenceMonitorError(err)) {
            return LoopResult.OK;
        }

        const {response} = await showErrorDialog({
            message: err.name + ' updating presence monitor',
            error: err,
            buttons: ['OK', 'Retry'],
            defaultId: 0,
            app: this.app,
        });

        if (response === 1) {
            return LoopResult.OK_SKIP_INTERVAL;
        }

        return LoopResult.OK;
    }

    async getDiscordStatus(): Promise<DiscordStatus | null> {
        const monitor = this.getActiveDiscordPresenceMonitor();
        if (!monitor) return null;

        return {
            error_message: monitor.discord.last_update_error ?
                monitor.discord.last_update_error instanceof Error ?
                    monitor.discord.last_update_error.name + ': ' + monitor.discord.last_update_error.message :
                ErrorDescription.getErrorDescription(monitor.discord.last_update_error) : null,
        };
    }

    async showDiscordPresenceLastUpdateError() {
        const monitor = this.getActiveDiscordPresenceMonitor();
        const error = monitor?.discord.last_update_error;
        if (!error) return;

        await showErrorDialog({
            message: error.name + ' updating presence monitor',
            error,
            app: this.app,
        });
    }
}

export class EmbeddedPresenceMonitor extends ZncDiscordPresence {
    onError?: (error: ErrorResponse<CoralError> | NodeJS.ErrnoException) =>
        Promise<LoopResult | void> | LoopResult | void = undefined;

    constructor(
        user: CoralUser<CoralApiInterface>,
        storage: LocalStorage,
        readonly token: string,
    ) {
        super(user, storage);
    }

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

            debug('Monitor for user %s finished', this.user.data.nsoAccount.user.name);
        } finally {
            this._running = 0;
        }
    }

    async handleError(err: ErrorResponse<CoralError> | NodeJS.ErrnoException): Promise<LoopResult> {
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
    onError?: (error: ErrorResponse<CoralError> | NodeJS.ErrnoException) =>
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

    async handleError(err: ErrorResponse<CoralError> | NodeJS.ErrnoException): Promise<LoopResult> {
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
        const currenttitle = friend.presence.game as PresenceGame;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.image2Uri),
        }).show();
    }

    async onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        new Notification({
            title: friend.name,
            body: this.t('offline')!,
            icon: await tryGetNativeImageFromUrl(friend.image2Uri),
        }).show();
    }

    async onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as PresenceGame;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.image2Uri),
        }).show();
    }

    async onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as PresenceGame;

        new Notification({
            title: friend.name,
            body: this.t('playing', {name: currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : '')})!,
            icon: await tryGetNativeImageFromUrl(friend.image2Uri),
        }).show();
    }
}

function checkShouldIgnorePresenceMonitorError(err: Error): boolean {
    // Invalid session token, the user needs to sign in again
    if (err instanceof InvalidNintendoAccountTokenError) {
        return false;
    }

    // Received error getting a Nintendo Account token; usually this means
    // the session token is invalid and the user needs to sign in again
    if (err instanceof NintendoAccountAuthErrorResponse && err.data) {
        return false;
    }

    // Received error getting Nintendo Account user data
    // This can only happen once when the app starts and there isn't a cached token
    if (err instanceof NintendoAccountErrorResponse && err.data) {
        return false;
    }

    // Received error from Coral (see CoralStatus in src/api/coral-types.ts)
    // This usually should either not happen (e.g. BAD_REQUEST), is something the
    // user needs to do (e.g. NSA_NOT_LINKED or UPGRADE_REQUIRED), or is permanent
    if (err instanceof CoralErrorResponse && err.data) {
        return false;
    }

    return true;
}
