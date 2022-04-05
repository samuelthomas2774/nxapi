import { app, BrowserWindow, ipcMain } from '../electron.js';
import * as path from 'path';
import createDebug from 'debug';
import * as persist from 'node-persist';
import { initStorage, paths } from '../../util.js';
import MenuApp from './menu.js';
import { EventEmitter } from 'events';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const debug = createDebug('app:main');

const __dirname = path.join(import.meta.url.substr(7), '..');
const bundlepath = path.join(import.meta.url.substr(7), '..', '..', 'bundle');

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

    const sendToAllWindows = (channel: string, ...args: any[]) =>
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, ...args));
    store.on('update-nintendo-accounts', () => sendToAllWindows('nxapi:accounts:shouldrefresh'));

    const menu = new MenuApp(store);

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
