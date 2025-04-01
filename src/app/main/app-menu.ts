import { i18n } from 'i18next';
import { GITHUB_MIRROR_URL, GITLAB_URL, ISSUES_URL } from '../../common/constants.js';
import { app, BrowserWindow, Menu, MenuItem, shell } from 'electron';
import { App } from './index.js';
import { createLogArchive } from './support.js';

let appinstance: App | null;

export function setAppInstance(app: App) {
    appinstance = app;
}

function createAppMenuItems(i18n?: i18n) {
    const menu_app = new MenuItem({
        role: 'appMenu',
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
                label: i18n?.t('app_menu:preferences') ?? 'Preferences',
                accelerator: 'CommandOrControl+,',
                click: () => {
                    appinstance?.showPreferencesWindow();
                },
            },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
        ],
    });

    const menu_file = new MenuItem({role: 'fileMenu'});
    const menu_edit = new MenuItem({role: 'editMenu'});

    const menu_window = new MenuItem({role: 'windowMenu'});

    const menu_help = new MenuItem({
        role: 'help',
        submenu: [
            {
                label: i18n?.t('app_menu:learn_more') ?? 'Learn More',
                click: async () => {
                    await shell.openExternal(GITLAB_URL);
                },
            },
            {
                label: i18n?.t('app_menu:learn_more_github') ?? 'Learn More (GitHub)',
                click: async () => {
                    await shell.openExternal(GITHUB_MIRROR_URL);
                },
            },
            {
                label: i18n?.t('app_menu:search_issues') ?? 'Search Issues',
                click: async () => {
                    await shell.openExternal(ISSUES_URL);
                },
            },
            {
                label: i18n?.t('app_menu:export_logs') ?? 'Export Logs',
                click: () => {
                    createLogArchive();
                },
            },
        ],
    });

    return {menu_app, menu_file, menu_edit, menu_window, menu_help};
}

function createAppMenu(i18n?: i18n) {
    const {menu_app, menu_file, menu_edit, menu_window, menu_help} = createAppMenuItems(i18n);

    const menu_view = new MenuItem({
        label: i18n?.t('app_menu:view') ?? 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    });

    return Menu.buildFromTemplate([
        ...(process.platform === 'darwin' ? [menu_app] : []),
        menu_file,
        menu_edit,
        menu_view,
        menu_window,
        menu_help,
    ]);
}

let app_menu = createAppMenu();

const menu_window_supports_refresh = new WeakSet<BrowserWindow>();

export function createWindowMenu(window: BrowserWindow, i18n = appinstance?.i18n) {
    menu_window_supports_refresh.add(window);

    const {menu_app, menu_file, menu_edit, menu_window, menu_help} = createAppMenuItems(i18n);

    const menu_view = new MenuItem({
        label: i18n?.t('app_menu:view') ?? 'View',
        submenu: [
            {
                id: 'window_refresh',
                label: i18n?.t('app_menu:refresh') ?? 'Refresh',
                click: (menuItem, browserWindow, event) => {
                    if (browserWindow && menu_window_supports_refresh.has(browserWindow)) {
                        browserWindow.webContents.send('nxapi:window:refresh');
                    } else {
                        browserWindow?.webContents.reload();
                    }
                },
                accelerator: 'CommandOrControl+R',
            },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    });

    return Menu.buildFromTemplate([
        ...(process.platform === 'darwin' ? [menu_app] : []),
        menu_file,
        menu_edit,
        menu_view,
        menu_window,
        menu_help,
    ]);
}

const menus = new WeakMap<BrowserWindow, Menu>();

app.on('browser-window-focus', (event, window) => {
    Menu.setApplicationMenu(menus.get(window) ?? app_menu);
});
app.on('browser-window-blur', (event, window) => {
    if (!BrowserWindow.getFocusedWindow()) {
        Menu.setApplicationMenu(app_menu);
    }
});

export function setWindowMenu(window: BrowserWindow, menu: Menu) {
    menus.set(window, menu);
    if (window.isFocused()) Menu.setApplicationMenu(app_menu);
}

export function updateMenuLanguage(i18n: i18n) {
    app_menu = createAppMenu(i18n);

    for (const window of BrowserWindow.getAllWindows()) {
        if (!menus.has(window)) continue;
        menus.set(window, createWindowMenu(window, i18n));
    }

    Menu.setApplicationMenu(menus.get(BrowserWindow.getFocusedWindow()!) ?? app_menu);
}
