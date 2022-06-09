import { app, BrowserWindow, BrowserWindowConstructorOptions, Menu, session, WebContents } from './electron.js';
import * as path from 'node:path';
import { dev } from '../../util/product.js';
import { WindowConfiguration, WindowType } from '../common/types.js';
import { bundlepath } from './util.js';
import { app_menu, createWindowMenu } from './app-menu.js';
import { WebService } from '../../api/znc-types.js';

const windows = new WeakMap<WebContents, WindowConfiguration>();
const menus = new WeakMap<BrowserWindow, Menu>();

app.on('browser-window-focus', (event, window) => {
    Menu.setApplicationMenu(menus.get(window) ?? app_menu);
});
app.on('browser-window-blur', (event, window) => {
    if (!BrowserWindow.getFocusedWindow()) {
        Menu.setApplicationMenu(app_menu);
    }
});

export function createWindow<T extends WindowType>(
    type: T, props: WindowConfiguration<T>['props'],
    options?: BrowserWindowConstructorOptions
) {
    // Create the browser window
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        vibrancy: 'content',
        autoHideMenuBar: true,
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
    menus.set(window, createWindowMenu(window));

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

export function createWebServiceWindow(nsa_id: string, webservice: WebService, title_prefix?: string) {
    const browser_session = session.fromPartition('persist:webservices-' + nsa_id, {
        cache: false,
    });

    const window = new BrowserWindow({
        width: 375,
        height: 667,
        resizable: false,
        title: (title_prefix ?? '') + webservice.name,
        webPreferences: {
            session: browser_session,
            preload: path.join(bundlepath, 'preload-webservice.cjs'),
            contextIsolation: false,
            scrollBounce: true,
        },
    });

    menus.set(window, createWindowMenu(window));

    return window;
}
