import { BrowserWindow, BrowserWindowConstructorOptions, nativeTheme, session, WebContents } from './electron.js';
import * as path from 'node:path';
import { dev } from '../../util/product.js';
import { WindowConfiguration, WindowType } from '../common/types.js';
import { bundlepath } from './util.js';
import { createWindowMenu, setWindowMenu } from './app-menu.js';
import { WebService } from '../../api/coral-types.js';

const windows = new WeakMap<WebContents, WindowConfiguration>();

export function createWindow<T extends WindowType>(
    type: T, props: WindowConfiguration<T>['props'],
    options?: BrowserWindowConstructorOptions,
) {
    // Create the browser window
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        vibrancy: 'content',
        autoHideMenuBar: true,
        title: 'nxapi',
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
    setWindowMenu(window, createWindowMenu(window));

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

const modal_window_width = new WeakMap<BrowserWindow, number>();
const modal_window_shown = new WeakSet<BrowserWindow>();

export function createModalWindow<T extends WindowType>(
    type: T, props: WindowConfiguration<T>['props'],
    parent?: BrowserWindow | WebContents,
    options?: BrowserWindowConstructorOptions,
) {
    if (parent && !(parent instanceof BrowserWindow)) {
        parent = BrowserWindow.fromWebContents(parent) ?? undefined;
    }

    const window = createWindow(type, props, {
        parent,
        modal: !!parent,
        show: false,
        maximizable: false,
        minimizable: false,
        width: 560,
        height: 300,
        minWidth: 450,
        maxWidth: 700,
        minHeight: 300,
        maxHeight: 300,

        ...options,
    });

    if (process.platform === 'win32') {
        // Use a fixed window width on Windows due to a bug getting/setting window size
        window.setResizable(false);
        modal_window_width.set(window, options?.width ?? 560);
    }

    return window;
}

export function setWindowHeight(window: BrowserWindow, height: number) {
    const [curWidth, curHeight] = window.getSize();
    const [curContentWidth, curContentHeight] = window.getContentSize();
    const [minWidth, minHeight] = window.getMinimumSize();
    const [maxWidth, maxHeight] = window.getMaximumSize();

    if (height !== curContentHeight && curHeight === minHeight && curHeight === maxHeight) {
        window.setMinimumSize(minWidth, height + (curHeight - curContentHeight));
        window.setMaximumSize(maxWidth, height + (curHeight - curContentHeight));
    }

    window.setContentSize(modal_window_width.get(window) ?? curContentWidth, height);

    if (!modal_window_shown.has(window)) {
        window.show();
        modal_window_shown.add(window);
    }
}

const BACKGROUND_COLOUR_MAIN_LIGHT = process.platform === 'win32' ? '#ffffff' : '#ececec';
const BACKGROUND_COLOUR_MAIN_DARK = process.platform === 'win32' ? '#000000' : '#252424';

export function createWebServiceWindow(nsa_id: string, webservice: WebService, title_prefix?: string) {
    const browser_session = session.fromPartition('persist:webservices-' + nsa_id, {
        cache: false,
    });

    const window = new BrowserWindow({
        width: 375,
        height: 667,
        autoHideMenuBar: true,
        title: (title_prefix ?? '') + webservice.name,
        backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND_COLOUR_MAIN_DARK : BACKGROUND_COLOUR_MAIN_LIGHT,
        webPreferences: {
            session: browser_session,
            preload: path.join(bundlepath, 'preload-webservice.cjs'),
            contextIsolation: false,
            scrollBounce: true,
            disableBlinkFeatures: 'UserAgentClientHint',
        },
    });

    setWindowMenu(window, createWindowMenu(window));

    window.loadURL('about:blank');
    if (dev) window.webContents.openDevTools();

    return window;
}
