import { dialog, Notification } from './electron.js';
import createDebug from 'debug';
import { CurrentUser, Friend, Game, ZncErrorResponse } from '../../api/znc-types.js';
import { ErrorResponse } from '../../api/util.js';
import { ZncDiscordPresence, ZncProxyDiscordPresence } from '../../common/presence.js';
import { NotificationManager } from '../../common/notify.js';
import { LoopResult } from '../../util/loop.js';
import { tryGetNativeImageFromUrl } from './util.js';
import { App } from './index.js';
import { DiscordPresenceSource } from '../common/types.js';
import { DiscordPresence } from '../../discord/util.js';
import { DiscordRpcClient } from '../../discord/rpc.js';

const debug = createDebug('app:main:monitor');

export class PresenceMonitorManager {
    monitors: (EmbeddedPresenceMonitor | EmbeddedProxyPresenceMonitor)[] = [];
    notifications = new ElectronNotificationManager();

    constructor(
        public app: App
    ) {}

    async start(id: string, callback?: (monitor: EmbeddedPresenceMonitor, firstRun: boolean) => void) {
        debug('Starting monitor', id);

        const token = id.length === 16 ? await this.app.store.storage.getItem('NintendoAccountToken.' + id) : id;
        if (!token) throw new Error('No token for this user');

        const user = await this.app.store.users.get(token);

        const existing = this.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === user.data.user.id);
        if (existing) {
            callback?.call(null, existing as EmbeddedPresenceMonitor, false);
            return;
        }

        const i = new EmbeddedPresenceMonitor(this.app.store.storage, token, user.nso, user.data, user);

        i.notifications = this.notifications;
        i.presence_user = null;
        i.user_notifications = false;
        i.friend_notifications = false;

        i.discord.onUpdateActivity = (presence: DiscordPresence | null) => {
            this.app.store.emit('update-discord-presence', presence);
        };
        i.discord.onUpdateClient = (client: DiscordRpcClient | null) => {
            this.app.store.emit('update-discord-user', client?.user ?? null);
        };

        this.monitors.push(i);

        callback?.call(null, i, true);

        i.enable();
    }

    async startUrl(presence_url: string) {
        debug('Starting monitor', presence_url);

        const existing = this.monitors.find(m => m instanceof EmbeddedProxyPresenceMonitor && m.presence_url === presence_url);
        if (existing) return;

        const i = new EmbeddedProxyPresenceMonitor(presence_url);

        i.notifications = this.notifications;

        i.discord.onUpdateActivity = (presence: DiscordPresence | null) => {
            this.app.store.emit('update-discord-presence', presence);
        };
        i.discord.onUpdateClient = (client: DiscordRpcClient | null) => {
            this.app.store.emit('update-discord-user', client?.user ?? null);
        };

        this.monitors.push(i);

        i.enable();
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

    getDiscordPresence() {
        return this.getActiveDiscordPresenceMonitor()?.discord.last_activity ?? null;
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

    async setDiscordPresenceSource(source: DiscordPresenceSource | null) {
        const monitor = this.getActiveDiscordPresenceMonitor();

        if (source && 'na_id' in source &&
            monitor && monitor instanceof EmbeddedPresenceMonitor &&
            monitor.data.user.id === source.na_id &&
            monitor.presence_user !== (source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId)
        ) {
            await this.start(source.na_id, monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId;
                monitor.skipIntervalInCurrentLoop();
            });
            this.app.store.saveMonitorState(this);
            this.app.menu?.updateMenu();
            return;
        }

        if (monitor) {
            if (source && 'na_id' in source && monitor instanceof EmbeddedPresenceMonitor && monitor.data.user.id === source.na_id) return;
            if (source && 'url' in source && monitor instanceof EmbeddedProxyPresenceMonitor && monitor.presence_url === source.url) return;

            monitor.discord.updatePresenceForDiscord(null);

            if (monitor instanceof EmbeddedPresenceMonitor) {
                monitor.presence_user = null;

                if (!monitor.user_notifications && !monitor.friend_notifications) {
                    this.stop(monitor.data.user.id);
                }
            }

            if (monitor instanceof EmbeddedProxyPresenceMonitor) {
                this.stop(monitor.presence_url);
            }
        }

        if (source && 'na_id' in source) {
            await this.start(source.na_id, monitor => {
                monitor.presence_user = source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId;
                monitor.skipIntervalInCurrentLoop();
            });
        } else if (source && 'url' in source) {
            await this.startUrl(source.url);
        }

        if (monitor || source) {
            this.app.store.saveMonitorState(this);
            this.app.menu?.updateMenu();
            this.app.store.emit('update-discord-presence-source', source);
        }
    }
}

export class EmbeddedPresenceMonitor extends ZncDiscordPresence {
    notifications = new ElectronNotificationManager();

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
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

            if (this._running === 0) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

            debug('Monitor for user %s finished', this.data.nsoAccount.user.name);
        } finally {
            this._running = 0;
        }
    }

    async handleError(err: ErrorResponse<ZncErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        try {
            return await super.handleError(err);
        } catch (err) {
            if (err instanceof ErrorResponse) {
                dialog.showErrorBox('Request error',
                    err.response.status + ' ' + err.response.statusText + ' ' +
                    err.response.url + '\n' + 
                    err.body + '\n\n' +
                    (err.stack ?? err.message));
            } else if (err instanceof Error) {
                dialog.showErrorBox(err.name, err.stack ?? err.message);
            } else {
                dialog.showErrorBox('Error', err as any);
            }

            return LoopResult.OK;
        }
    }

    skipIntervalInCurrentLoop(start = false) {
        super.skipIntervalInCurrentLoop();
        if (!this._running && start) this.enable();
    }
}

export class EmbeddedProxyPresenceMonitor extends ZncProxyDiscordPresence {
    notifications = new ElectronNotificationManager();

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
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

            if (this._running === 0) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

            debug('Monitor for presence URL %s finished', this.presence_url);
        } finally {
            this._running = 0;
        }
    }

    async handleError(err: ErrorResponse<ZncErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        try {
            return await super.handleError(err);
        } catch (err) {
            if (err instanceof ErrorResponse) {
                dialog.showErrorBox('Request error',
                    err.response.status + ' ' + err.response.statusText + ' ' +
                    err.response.url + '\n' + 
                    err.body + '\n\n' +
                    (err.stack ?? err.message));
            } else if (err instanceof Error) {
                dialog.showErrorBox(err.name, err.stack ?? err.message);
            } else {
                dialog.showErrorBox('Error', err as any);
            }

            return LoopResult.OK;
        }
    }

    skipIntervalInCurrentLoop(start = false) {
        super.skipIntervalInCurrentLoop();
        if (!this._running && start) this.enable();
    }
}

export class ElectronNotificationManager extends NotificationManager {
    async onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        new Notification({
            title: friend.name,
            body: 'Offline',
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, naid?: string, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await tryGetNativeImageFromUrl(friend.imageUri),
        }).show();
    }
}
