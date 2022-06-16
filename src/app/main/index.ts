import { app, BrowserWindow, dialog, ipcMain } from './electron.js';
import process from 'node:process';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import createDebug from 'debug';
import * as persist from 'node-persist';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import MenuApp from './menu.js';
import { handleOpenWebServiceUri } from './webservices.js';
import { EmbeddedPresenceMonitor, PresenceMonitorManager } from './monitor.js';
import { createWindow } from './windows.js';
import { DiscordPresenceConfiguration, WindowType } from '../common/types.js';
import { initStorage, paths } from '../../util/storage.js';
import { checkUpdates, UpdateCacheData } from '../../common/update.js';
import Users, { CoralUser } from '../../common/users.js';
import { setupIpc } from './ipc.js';

const debug = createDebug('app:main');

export class App {
    readonly store: Store;
    readonly monitors: PresenceMonitorManager;
    readonly updater = new Updater();
    menu: MenuApp | null = null;

    constructor(storage: persist.LocalStorage) {
        this.store = new Store(this, storage);
        this.monitors = new PresenceMonitorManager(this);
    }

    main_window: BrowserWindow | null = null;

    showMainWindow() {
        if (this.main_window) {
            this.main_window.show();
            this.main_window.focus();
            return this.main_window;
        }

        const window = createWindow(WindowType.MAIN_WINDOW, {
            vibrancy: process.platform === 'darwin',
            // insetTitleBarControls: process.platform === 'darwin',
        }, {
            minWidth: 500,
            minHeight: 300,
            vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
            // titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            webPreferences: {
                scrollBounce: false,
            },
        });
        
        window.on('closed', () => this.main_window = null);

        return this.main_window = window;
    }
}

app.whenReady().then(async () => {
    dotenvExpand.expand(dotenv.config({
        path: path.join(paths.data, '.env'),
    }));
    if (process.env.NXAPI_DATA_PATH) dotenvExpand.expand(dotenv.config({
        path: path.join(process.env.NXAPI_DATA_PATH, '.env'),
    }));

    if (process.env.DEBUG) createDebug.enable(process.env.DEBUG);

    const storage = await initStorage(process.env.NXAPI_DATA_PATH ?? paths.data);
    const appinstance = new App(storage);

    setupIpc(appinstance, ipcMain);

    // @ts-expect-error
    globalThis.app = appinstance;

    appinstance.store.restoreMonitorState(appinstance.monitors);

    const menu = new MenuApp(appinstance);
    appinstance.menu = menu;

    app.on('open-url', (event, url) => {
        if (url.match(/^com\.nintendo\.znca:\/\/(znca\/)game\/(\d+)\/?($|\?|\#)/i)) {
            handleOpenWebServiceUri(appinstance.store, url);
            event.preventDefault();
        }
    });
    app.setAsDefaultProtocolClient('com.nintendo.znca');

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) appinstance.showMainWindow();
    });

    debug('App started');

    appinstance.showMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

class Updater {
    private _cache: UpdateCacheData | null = null;
    private _check: Promise<UpdateCacheData | null> | null = null;

    get cache() {
        return this._cache;
    }

    check() {
        return this._check ?? (this._check = checkUpdates().then(data => {
            this._cache = data;
            return data;
        }).finally(() => {
            this._check = null;
        }));
    }
}

interface SavedMonitorState {
    users: {
        /** Nintendo Account ID */
        id: string;
        user_notifications: boolean;
        friend_notifications: boolean;
    }[];
    discord_presence: DiscordPresenceConfiguration | null;
}

export class Store extends EventEmitter {
    readonly users: Users<CoralUser>;

    constructor(
        readonly app: App,
        readonly storage: persist.LocalStorage
    ) {
        super();

        this.users = Users.coral(storage, process.env.ZNC_PROXY_URL);
    }

    async saveMonitorState(monitors: PresenceMonitorManager) {
        const users = new Set();
        const state: SavedMonitorState = {
            users: [],
            discord_presence: null,
        };

        for (const monitor of monitors.monitors) {
            if (monitor instanceof EmbeddedPresenceMonitor && !users.has(monitor.data.user.id)) {
                users.add(monitor.data?.user.id);

                state.users.push({
                    id: monitor.data?.user.id,
                    user_notifications: monitor.user_notifications,
                    friend_notifications: monitor.friend_notifications,
                });
            }
        }

        state.discord_presence = monitors.getDiscordPresenceConfiguration();

        debug('Saving monitor state', state);
        await this.storage.setItem('AppMonitors', state);
    }

    async restoreMonitorState(monitors: PresenceMonitorManager) {
        const state: SavedMonitorState | undefined = await this.storage.getItem('AppMonitors');
        debug('Restoring monitor state', state);
        if (!state) return;

        for (const user of state.users) {
            const discord_presence_active = state.discord_presence && 'na_id' in state.discord_presence.source &&
                state.discord_presence.source.na_id === user.id;

            if (!discord_presence_active &&
                !user.user_notifications &&
                !user.friend_notifications
            ) continue;

            try {
                await monitors.start(user.id, monitor => {
                    monitor.presence_user = state.discord_presence && 'na_id' in state.discord_presence.source &&
                        state.discord_presence.source.na_id === user.id ?
                            state.discord_presence.source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId : null;
                    monitor.user_notifications = user.user_notifications;
                    monitor.friend_notifications = user.friend_notifications;

                    if (monitor.presence_user) {
                        monitor.discord_client_filter = state.discord_presence?.user ?
                            monitors.createDiscordClientFilter(state.discord_presence.user) : undefined;
                        this.emit('update-discord-presence-source', monitors.getDiscordPresenceSource());
                    }
                });
            } catch (err) {
                dialog.showErrorBox('Error restoring monitor for user ' + user.id,
                    err instanceof Error ? err.stack ?? err.message : err as any);
            }
        }

        if (state.discord_presence && 'url' in state.discord_presence.source) {
            try {
                const monitor = await monitors.startUrl(state.discord_presence.source.url);
                monitor.discord_client_filter = state.discord_presence?.user ?
                    monitors.createDiscordClientFilter(state.discord_presence.user) : undefined;
            } catch (err) {
                dialog.showErrorBox('Error restoring monitor for presence URL ' + state.discord_presence.source.url,
                    err instanceof Error ? err.stack ?? err.message : err as any);
            }
        }

        await this.app.menu?.updateMenu();
    }
}
