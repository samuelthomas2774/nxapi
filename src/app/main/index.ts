import { app, BrowserWindow, ipcMain, LoginItemSettingsOptions, session } from 'electron';
import process from 'node:process';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { setGlobalDispatcher } from 'undici';
import * as persist from 'node-persist';
import MenuApp from './menu.js';
import { handleOpenWebServiceUri } from './webservices.js';
import { EmbeddedPresenceMonitor, PresenceMonitorManager } from './monitor.js';
import { createModalWindow, createWindow } from './windows.js';
import { setupIpc } from './ipc.js';
import { askUserForUri, buildElectronProxyAgent, showErrorDialog } from './util.js';
import { setAppInstance } from './app-menu.js';
import { handleAuthUri } from './na-auth.js';
import { AppearanceItem, AppearanceItemOptions, DiscordPresenceConfiguration, LoginItem, LoginItemOptions, WindowType } from '../common/types.js';
import { init as initGlobals } from '../../common/globals.js';
import { CREDITS_NOTICE, GITLAB_URL, LICENCE_NOTICE } from '../../common/constants.js';
import { checkUpdates, UpdateCacheData } from '../../common/update.js';
import Users, { CoralUser } from '../../common/users.js';
import createDebug from '../../util/debug.js';
import { dev, dir, git, release, version } from '../../util/product.js';
import { addUserAgent } from '../../util/useragent.js';
import { initStorage, paths } from '../../util/storage.js';
import { CoralApiInterface } from '../../api/coral.js';

const debug = createDebug('app:main');

export const protocol_registration_options = dev && process.platform === 'win32' ? {
    path: process.execPath,
    argv: [
        path.join(dir, 'dist', 'app', 'app-entry.cjs'),
    ],
} : null;
export const login_item_options: LoginItemSettingsOptions = {
    path: process.execPath,
    args: dev ? [
        path.join(dir, 'dist', 'app', 'app-entry.cjs'),
        '--app-open-at-login=1',
    ] : [
        '--app-open-at-login=1',
    ],
};

enum LoginItemType {
    NATIVE,
    NATIVE_PARTIAL,
    NOT_SUPPORTED,
}
const login_item_type: LoginItemType =
    process.platform === 'darwin' ? LoginItemType.NATIVE :
    process.platform === 'win32' ? LoginItemType.NATIVE_PARTIAL :
    LoginItemType.NOT_SUPPORTED;

debug('Protocol registration options', protocol_registration_options);
debug('Login item registration options', LoginItemType[login_item_type], login_item_options);

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

    preferences_window: BrowserWindow | null = null;

    showPreferencesWindow() {
        if (this.preferences_window) {
            this.preferences_window.show();
            this.preferences_window.focus();
            return this.preferences_window;
        }

        const window = createModalWindow(WindowType.PREFERENCES, {});

        window.on('closed', () => this.preferences_window = null);

        return this.preferences_window = window;
    }
}

export async function init() {
    if (!app.requestSingleInstanceLock()) {
        debug('Failed to acquire single instance lock');
        console.warn('Failed to acquire single instance lock. Another instance of the app is running and will be focused.');
        setTimeout(() => app.quit(), 1000);
        return;
    }

    initGlobals();
    addUserAgent('nxapi-app (Chromium ' + process.versions.chrome + '; Electron ' + process.versions.electron + ')');

    const agent = buildElectronProxyAgent({
        session: session.defaultSession,
    });
    setGlobalDispatcher(agent);

    app.setAboutPanelOptions({
        applicationName: 'nxapi-app',
        applicationVersion: process.platform === 'darwin' ? version : version +
            (!release ? '-' + (git?.revision.substr(0, 8) ?? '?') : ''),
        version: git?.revision.substr(0, 8) ?? '?',
        authors: ['Samuel Elliott'],
        website: GITLAB_URL,
        credits: CREDITS_NOTICE,
        copyright: LICENCE_NOTICE,
    });

    const storage = await initStorage(process.env.NXAPI_DATA_PATH ?? paths.data);
    const appinstance = new App(storage);

    // @ts-expect-error
    globalThis.app = appinstance;

    setAppInstance(appinstance);
    setupIpc(appinstance, ipcMain);

    app.configureHostResolver({enableBuiltInResolver: false});

    if (process.platform === 'win32') {
        app.setAppUserModelId('uk.org.fancy.nxapi.app');
    }

    appinstance.store.restoreMonitorState(appinstance.monitors);

    const menu = new MenuApp(appinstance);
    appinstance.menu = menu;

    app.on('second-instance', (event, command_line, working_directory, additional_data) => {
        debug('Second instance', command_line, working_directory, additional_data);

        if (!tryHandleUrl(appinstance, command_line[command_line.length - 1])) {
            appinstance.showMainWindow();
        }
    });

    app.on('open-url', (event, url) => {
        debug('Open URL', url);

        event.preventDefault();

        if (!tryHandleUrl(appinstance, url)) {
            appinstance.showMainWindow();
        }
    });

    app.setAsDefaultProtocolClient('com.nintendo.znca',
        protocol_registration_options?.path, protocol_registration_options?.argv);

    app.on('activate', (event, has_visible_windows) => {
        debug('activate', has_visible_windows);

        if (BrowserWindow.getAllWindows().length === 0) appinstance.showMainWindow();
    });

    app.on('browser-window-created', () => {
        // Show the dock icon when any windows are open
        app.dock?.show();
    });

    app.on('window-all-closed', () => {
        // Listen to the window-all-closed event to prevent Electron quitting the app
        // https://www.electronjs.org/docs/latest/api/app#event-window-all-closed

        // Hide the dock icon when no windows are open
        // https://github.com/samuelthomas2774/nxapi/issues/18
        app.dock?.hide();
    });

    debug('App started');

    const should_hide_startup =
        login_item_type === LoginItemType.NATIVE ? app.getLoginItemSettings(login_item_options).wasOpenedAsHidden :
        process.argv.includes('--app-open-at-login=1') && (await appinstance.store.getLoginItem()).startup_hidden;

    const should_hide_launch = 
        process.argv.includes('--app-open-hidden=1') || 
        (await appinstance.store.getLoginItem()).launch_hidden;

    if (!(should_hide_startup || should_hide_launch)) {
        appinstance.showMainWindow();
    }
}

function tryHandleUrl(app: App, url: string) {
    debug('Attempting to handle URL', url);

    if (url.match(/^npf[0-9a-f]{16}:\/\/auth\/?($|\?|\#)/i)) {
        handleAuthUri(url);
        return true;
    }

    if (url.match(/^com\.nintendo\.znca:\/\/(znca\/)?game\/(\d+)\/?($|\?|\#)/i)) {
        handleOpenWebServiceUri(app.store, url);
        return true;
    }

    if (url.match(/^com\.nintendo\.znca:\/\/(znca\/)?friendcode\/(\d{4}-\d{4}-\d{4})\/([A-Za-z0-9]{10})($|\?|\#)/i)) {
        handleOpenFriendCodeUri(app.store, url);
        return true;
    }

    return false;
}

export async function handleOpenFriendCodeUri(store: Store, uri: string) {
    const match = uri.match(/^com\.nintendo\.znca:\/\/(znca\/)friendcode\/(\d{4}-\d{4}-\d{4})\/([A-Za-z0-9]{10})($|\?|\#)/i);
    if (!match) return;

    const friendcode = match[2];
    const hash = match[3];

    const selected_user = await askUserForUri(store, uri, 'Select a user to add friends');
    if (!selected_user) return;

    createModalWindow(WindowType.ADD_FRIEND, {
        user: selected_user[1].user.id,
        friendcode,
    });
}

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

interface SavedStartupOptions {
    hide: boolean;
    hideLaunch: boolean;
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
    readonly users: Users<CoralUser<CoralApiInterface>>;

    constructor(
        readonly app: App,
        readonly storage: persist.LocalStorage
    ) {
        super();

        // ratelimit = false, as most users.get calls are triggered by user interaction (or at startup)
        this.users = Users.coral(this, process.env.ZNC_PROXY_URL, false);
    }

    async getAppearanceItem(): Promise<AppearanceItem> {
        const options = await this.storage.getItem('Appearance');
        return options ?? null;
    }

    async setAppearanceItem(settings: AppearanceItemOptions) {
        await this.storage.setItem('Appearance', settings);
        await this.app.menu?.updateIcon();
    }

    async getLoginItem(): Promise<LoginItem> {
        const settings = app.getLoginItemSettings(login_item_options);

        if (login_item_type === LoginItemType.NATIVE) {
            // Fully supported
            return {
                supported: true,
                startup_enabled: settings.openAtLogin,
                startup_hidden: settings.openAsHidden,
                launch_hidden: settings.launchAsHidden
            };
        }

        const startup_options: SavedStartupOptions | undefined = await this.storage.getItem('StartupOptions');
        const was_opened_at_login = process.argv.includes('--app-open-at-login=1');

        if (login_item_type === LoginItemType.NATIVE_PARTIAL) {
            // Partial native support
            return {
                supported: true,
                startup_enabled: settings.openAtLogin,
                startup_hidden: startup_options?.hide ?? false,
                launch_hidden: startup_options?.hideLaunch ?? false,
            };
        }

        return {
            supported: false,
            startup_enabled: was_opened_at_login,
            startup_hidden: startup_options?.hide ?? false,
            launch_hidden: startup_options?.hideLaunch ?? false,
        };
    }

    async setLoginItem(settings: LoginItemOptions) {
        if (login_item_type === LoginItemType.NATIVE) {
            // Fully supported
            app.setLoginItemSettings({
                ...login_item_options,
                openAtLogin: settings.startup_enabled,
                openAsHidden: settings.startup_hidden,
                launchAsHidden: settings.launch_hidden,
            });
            return;
        }

        if (login_item_type === LoginItemType.NATIVE_PARTIAL) {
            // Partial native support
            app.setLoginItemSettings({
                ...login_item_options,
                openAtLogin: settings.startup_enabled,
                launchAsHidden: settings.launch_hidden,
            });
        }

        const startup_options: SavedStartupOptions = {
            hide: settings.startup_hidden,
            hideLaunch: settings.launch_hidden,
        };

        await this.storage.setItem('StartupOptions', startup_options);
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

        if (state.discord_presence) {
            await this.storage.setItem('AppDiscordPresenceOptions', {
                ...state.discord_presence,
                source: undefined,
            });
        }
    }

    async getSavedDiscordPresenceOptions() {
        const options: Omit<DiscordPresenceConfiguration, 'source'> | undefined =
            await this.storage.getItem('AppDiscordPresenceOptions');

        return options ?? null;
    }

    async restoreMonitorState(monitors: PresenceMonitorManager) {
        const state: SavedMonitorState | undefined = await this.storage.getItem('AppMonitors');
        debug('Restoring monitor state', state);
        if (!state) return;

        for (const user of state.users) {
            this.restoreUserMonitorState(monitors, state, user);
        }

        if (state.discord_presence && 'url' in state.discord_presence.source) {
            this.restorePresenceUrlMonitorState(monitors, state);
        }
    }

    async restoreUserMonitorState(
        monitors: PresenceMonitorManager,
        state: SavedMonitorState, user: SavedMonitorState['users'][0]
    ): Promise<void> {
        const discord_presence_active = state.discord_presence && 'na_id' in state.discord_presence.source &&
            state.discord_presence.source.na_id === user.id;

        if (!discord_presence_active &&
            !user.user_notifications &&
            !user.friend_notifications
        ) return;

        try {
            await monitors.start(user.id, monitor => {
                monitor.presence_user = state.discord_presence && 'na_id' in state.discord_presence.source &&
                    state.discord_presence.source.na_id === user.id ?
                        state.discord_presence.source.friend_nsa_id ?? monitor.data.nsoAccount.user.nsaId : null;
                monitor.user_notifications = user.user_notifications;
                monitor.friend_notifications = user.friend_notifications;

                if (monitor.presence_user) {
                    monitors.setDiscordPresenceConfigurationForMonitor(monitor, state.discord_presence!);
                    this.emit('update-discord-presence-source', monitors.getDiscordPresenceSource());
                }
            });

            await this.app.menu?.updateMenu();
        } catch (err) {
            debug('Error restoring monitor for user %s', user.id, err);

            const {response} = await showErrorDialog({
                message: (err instanceof Error ? err.name : 'Error') + ' restoring monitor for user ' + user.id,
                error: err,
                buttons: ['OK', 'Retry'],
                defaultId: 1,
            });

            if (response === 1) {
                return this.restoreUserMonitorState(monitors, state, user);
            }
        }
    }

    async restorePresenceUrlMonitorState(
        monitors: PresenceMonitorManager,
        state: SavedMonitorState
    ): Promise<void> {
        if (!state.discord_presence || !('url' in state.discord_presence.source)) return;

        try {
            const monitor = await monitors.startUrl(state.discord_presence.source.url);
            monitors.setDiscordPresenceConfigurationForMonitor(monitor, state.discord_presence);
            this.emit('update-discord-presence-source', monitors.getDiscordPresenceSource());

            await this.app.menu?.updateMenu();
        } catch (err) {
            debug('Error restoring monitor for presence URL %s', state.discord_presence.source.url, err);

            const {response} = await showErrorDialog({
                message: (err instanceof Error ? err.name : 'Error') + ' restoring monitor for presence URL ' +
                    state.discord_presence.source.url,
                error: err,
                buttons: ['OK', 'Retry'],
                defaultId: 1,
            });

            if (response === 1) {
                return this.restorePresenceUrlMonitorState(monitors, state);
            }
        }
    }
}
