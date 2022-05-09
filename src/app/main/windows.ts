import { app, BrowserWindow, dialog, ipcMain, nativeImage, Notification, WebContents } from '../electron.js';
import * as path from 'path';
import { bundlepath } from './index.js';
import { dev } from '../../util.js';
import { WindowConfiguration, WindowType } from '../common/types.js';

const windows = new Map<WebContents, WindowConfiguration>();

export function createWindow<T extends WindowType>(type: T, props: WindowConfiguration<T>['props']) {
    // Create the browser window
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        vibrancy: 'content',
        webPreferences: {
            preload: path.join(bundlepath, 'preload.cjs'),
            scrollBounce: true,
        },
    });

    const data: WindowConfiguration<T> = {
        type,
        props,
    };

    windows.set(window.webContents, data);

    window.loadFile(path.join(bundlepath, 'index.html'));
    if (dev) window.webContents.openDevTools();

    return window;
}

export function getWindowConfiguration(webcontents: WebContents): WindowConfiguration {
    const data = windows.get(webcontents);

    if (!data) {
        throw new Error('Unknown window');
    }

    return data;
}
