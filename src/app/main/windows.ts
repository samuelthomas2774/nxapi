import { BrowserWindow, BrowserWindowConstructorOptions, WebContents } from './electron.js';
import * as path from 'node:path';
import { dev } from '../../util/product.js';
import { WindowConfiguration, WindowType } from '../common/types.js';
import { bundlepath } from './util.js';

const windows = new Map<WebContents, WindowConfiguration>();

export function createWindow<T extends WindowType>(
    type: T, props: WindowConfiguration<T>['props'],
    options?: BrowserWindowConstructorOptions
) {
    // Create the browser window
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        vibrancy: 'content',
        ...options,
        webPreferences: {
            preload: path.join(bundlepath, 'preload.cjs'),
            scrollBounce: true,
            ...options?.webPreferences,
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
