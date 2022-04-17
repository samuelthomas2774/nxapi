import { app, BrowserWindow, ipcMain, nativeImage, Notification } from '../electron.js';
import * as path from 'path';
import { EventEmitter } from 'events';
import createDebug from 'debug';
import * as persist from 'node-persist';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { getToken, initStorage, paths } from '../../util.js';
import MenuApp from './menu.js';
import { ZncDiscordPresence } from '../../cli/nso/presence.js';
import { WebServiceIpc } from './webservices.js';
import { CurrentUser, Friend, Game } from '../../api/znc-types.js';
import { NotificationManager } from '../../cli/nso/notify.js';

const debug = createDebug('app:main');

const __dirname = path.join(import.meta.url.substr(7), '..');
export const bundlepath = path.join(import.meta.url.substr(7), '..', '..', 'bundle');

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        vibrancy: 'content',
        webPreferences: {
            preload: path.join(bundlepath, 'preload.cjs'),
            scrollBounce: true,
        },
    });

    mainWindow.loadFile(path.join(bundlepath, 'index.html'));
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
    const store = new Store(storage);

    ipcMain.handle('nxapi:accounts:list', () => storage.getItem('NintendoAccountIds'));
    ipcMain.handle('nxapi:nso:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken.' + id));
    ipcMain.handle('nxapi:nso:getcachedtoken', (e, token: string) => storage.getItem('NsoToken.' + token));
    ipcMain.handle('nxapi:moon:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken-pctl.' + id));
    ipcMain.handle('nxapi:moon:getcachedtoken', (e, token: string) => storage.getItem('MoonToken.' + token));

    const webserviceipc = new WebServiceIpc(store);
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShare', (e, data: string) => webserviceipc.invokeNativeShare(e, data));
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShareUrl', (e, data: string) => webserviceipc.invokeNativeShareUrl(e, data));
    ipcMain.handle('nxapi:webserviceapi:requestGameWebToken', e => webserviceipc.requestGameWebToken(e));
    ipcMain.handle('nxapi:webserviceapi:restorePersistentData', e => webserviceipc.restorePersistentData(e));
    ipcMain.handle('nxapi:webserviceapi:storePersistentData', (e, data: string) => webserviceipc.storePersistentData(e, data));

    const sendToAllWindows = (channel: string, ...args: any[]) =>
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, ...args));
    store.on('update-nintendo-accounts', () => sendToAllWindows('nxapi:accounts:shouldrefresh'));

    const monitors = new PresenceMonitorManager(store);
    const menu = new MenuApp(store, monitors);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    debug('App started');

    // createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

export class Store extends EventEmitter {
    constructor(
        public storage: persist.LocalStorage
    ) {
        super();
    }

    //
}

export class PresenceMonitorManager {
    monitors: EmbeddedPresenceMonitor[] = [];
    notifications = new ElectronNotificationManager();

    constructor(
        public store: Store
    ) {}

    async start(id: string, callback?: (monitor: EmbeddedPresenceMonitor, firstRun: boolean) => void) {
        debug('Starting monitor', id);

        const token = id.length === 16 ? await this.store.storage.getItem('NintendoAccountToken.' + id) : id;
        if (!token) throw new Error('No token for this user');

        const {nso, data} = await getToken(this.store.storage, token, process.env.ZNC_PROXY_URL);

        const existing = this.monitors.find(m => m.data.user.id === data.user.id);
        if (existing) {
            callback?.call(null, existing, false);
            return;
        }

        const i = new EmbeddedPresenceMonitor({
            userNotifications: false,
            friendNotifications: false,
            updateInterval: 60,
            friendCode: undefined,
            showInactivePresence: false,
            showEvent: false,
            friendNsaid: undefined,
        }, this.store.storage, token, nso, data);

        i.notifications = this.notifications;
        i.presence_user = null;

        this.monitors.push(i);

        callback?.call(null, i, true);

        i.enable();
    }

    async stop(id: string) {
        let index;
        while ((index = this.monitors.findIndex(m => m.data.user.id === id)) >= 0) {
            const i = this.monitors[index];

            this.monitors.splice(index, 1);

            i.disable();
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
}

export class ElectronNotificationManager extends NotificationManager {
    private async getNativeImageFromUrl(url: string) {
        try {
            const response = await fetch(url);
            const image = await response.buffer();
            return nativeImage.createFromBuffer(image);
        } catch (err) {}

        return undefined;
    }

    async onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await this.getNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        new Notification({
            title: friend.name,
            body: 'Offline',
            icon: await this.getNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await this.getNativeImageFromUrl(friend.imageUri),
        }).show();
    }

    async onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        new Notification({
            title: friend.name,
            body: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            icon: await this.getNativeImageFromUrl(friend.imageUri),
        }).show();
    }
}
