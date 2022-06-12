import { GITHUB_MIRROR_URL, GITLAB_URL, ISSUES_URL } from '../../common/constants.js';
import { BrowserWindow, Menu, MenuItem, shell } from './electron.js';

const menu_app = new MenuItem({role: 'appMenu'});
const menu_file = new MenuItem({role: 'fileMenu'});
const menu_edit = new MenuItem({role: 'editMenu'});

const menu_view = new MenuItem({
    label: 'View',
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

const menu_window = new MenuItem({role: 'windowMenu'});

const menu_help = new MenuItem({
    role: 'help',
    submenu: [
        {
            label: 'Learn More',
            click: async () => {
                await shell.openExternal(GITLAB_URL);
            },
        },
        {
            label: 'Learn More (GitHub)',
            click: async () => {
                await shell.openExternal(GITHUB_MIRROR_URL);
            },
        },
        {
            label: 'Search Issues',
            click: async () => {
                await shell.openExternal(ISSUES_URL);
            },
        },
    ],
});

export const app_menu = Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [menu_app] : []),
    menu_file,
    menu_edit,
    menu_view,
    menu_window,
    menu_help,
]);

export function createWindowMenu(window: BrowserWindow) {
    const menu_view = new MenuItem({
        label: 'View',
        submenu: [
            {
                label: 'Refresh',
                click: (menuItem, browserWindow, event) => {
                    if (browserWindow === window) {
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
