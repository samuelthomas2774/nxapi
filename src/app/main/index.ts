import electron from '../electron.js';
import * as path from 'path';
import persist from 'node-persist';
import { initStorage, paths } from '../../util.js';

const __dirname = path.join(import.meta.url.substr(7), '..');
const bundlepath = path.join(import.meta.url.substr(7), '..', '..', 'bundle');

const { app, BrowserWindow, ipcMain } = electron;

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
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    const storage = await initStorage(paths.data);

    ipcMain.handle('nxapi:accounts:list', () => storage.getItem('NintendoAccountIds'));
    ipcMain.handle('nxapi:nso:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken.' + id));
    ipcMain.handle('nxapi:nso:getcachedtoken', (e, token: string) => storage.getItem('NsoToken.' + token));
    ipcMain.handle('nxapi:moon:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken-pctl.' + id));
    ipcMain.handle('nxapi:moon:getcachedtoken', (e, token: string) => storage.getItem('MoonToken.' + token));
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
