import { BrowserWindow, dialog, IpcMain, ShareMenu, SharingItem, shell, systemPreferences } from './electron.js';
import * as util from 'node:util';
import createDebug from 'debug';
import openWebService, { WebServiceIpc } from './webservices.js';
import { createWindow, getWindowConfiguration } from './windows.js';
import { DiscordPresenceSource, WindowType } from '../common/types.js';
import { WebService } from '../../api/znc-types.js';
import { addNsoAccount, addPctlAccount } from './na-auth.js';
import { App } from './index.js';
import { DiscordPresence } from '../../discord/util.js';
import { User } from 'discord-rpc';

const debug = createDebug('app:main:ipc');

export function setupIpc(appinstance: App, ipcMain: IpcMain) {
    const store = appinstance.store;
    const storage = appinstance.store.storage;

    ipcMain.on('nxapi:browser:getwindowdata', e => e.returnValue = getWindowConfiguration(e.sender));

    let accent_colour = systemPreferences.getAccentColor();

    ipcMain.on('nxapi:systemPreferences:accent-colour', e => e.returnValue = accent_colour);
    systemPreferences.subscribeLocalNotification('NSSystemColorsDidChangeNotification', (event, userInfo, object) => {
        accent_colour = systemPreferences.getAccentColor();
        sendToAllWindows('nxapi:systemPreferences:accent-colour', accent_colour);
    });
    systemPreferences.on('accent-color-changed', (event, new_colour) => {
        accent_colour = new_colour ?? systemPreferences.getAccentColor();
        sendToAllWindows('nxapi:systemPreferences:accent-colour', accent_colour);
    });

    ipcMain.handle('nxapi:update:get', () => appinstance.updater.cache ?? appinstance.updater.check());
    ipcMain.handle('nxapi:update:check', () => appinstance.updater.check());

    setTimeout(async () => {
        const update = await appinstance.updater.check();
        if (update) sendToAllWindows('nxapi:update:latest', update);
    }, 60 * 60 * 1000);

    ipcMain.handle('nxapi:accounts:list', () => storage.getItem('NintendoAccountIds'));
    ipcMain.handle('nxapi:accounts:add-coral', () => addNsoAccount(store.storage).then(u => u.data.user.id));
    ipcMain.handle('nxapi:accounts:add-moon', () => addPctlAccount(store.storage).then(u => u.data.user.id));

    ipcMain.handle('nxapi:nso:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken.' + id));
    ipcMain.handle('nxapi:nso:getcachedtoken', (e, token: string) => storage.getItem('NsoToken.' + token));
    ipcMain.handle('nxapi:nso:announcements', (e, token: string) => store.users.get(token).then(u => u.announcements.result));
    ipcMain.handle('nxapi:nso:friends', (e, token: string) => store.users.get(token).then(u => u.getFriends()));
    ipcMain.handle('nxapi:nso:webservices', (e, token: string) => store.users.get(token).then(u => u.getWebServices()));
    ipcMain.handle('nxapi:nso:openwebservice', (e, webservice: WebService, token: string, qs?: string) =>
        store.users.get(token).then(u => openWebService(store, token, u.nso, u.data, webservice, qs)
            .catch(err => dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender)!, {
                type: 'error',
                title: 'Error opening web service',
                message: err.message,
                detail: (err instanceof Error ? err.stack ?? '' : err) + '\n\n' + util.inspect({
                    webservice: {
                        id: webservice.id,
                        name: webservice.name,
                        uri: webservice.uri,
                    },
                    qs,
                    user_na_id: u.data.user.id,
                    user_nsa_id: u.data.nsoAccount.user.nsaId,
                    user_coral_id: u.data.nsoAccount.user.id,
                }, {compact: true}),
            }))));
    ipcMain.handle('nxapi:nso:activeevent', (e, token: string) => store.users.get(token).then(u => u.getActiveEvent()));

    ipcMain.handle('nxapi:window:showfriend', (e, na_id: string, nsa_id: string) => createWindow(WindowType.FRIEND, {
        user: na_id,
        friend: nsa_id,
    }, {
        parent: BrowserWindow.fromWebContents(e.sender) ?? undefined,
        modal: true,
        width: 560,
        height: 300,
    }).id);

    ipcMain.handle('nxapi:discord:source', () => appinstance.monitors.getDiscordPresenceSource());
    ipcMain.handle('nxapi:discord:setsource', (e, source: DiscordPresenceSource | null) => appinstance.monitors.setDiscordPresenceSource(source));
    ipcMain.handle('nxapi:discord:presence', () => appinstance.monitors.getDiscordPresence());
    ipcMain.handle('nxapi:discord:user', () => appinstance.monitors.getActiveDiscordPresenceMonitor()?.discord.rpc?.client.user ?? null);

    ipcMain.handle('nxapi:moon:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken-pctl.' + id));
    ipcMain.handle('nxapi:moon:getcachedtoken', (e, token: string) => storage.getItem('MoonToken.' + token));

    ipcMain.handle('nxapi:misc:open-url', (e, url: string) => shell.openExternal(url));
    ipcMain.handle('nxapi:misc:share', (e, item: SharingItem) =>
        new ShareMenu(item).popup({window: BrowserWindow.fromWebContents(e.sender)!}));

    const webserviceipc = new WebServiceIpc(store);
    ipcMain.on('nxapi:webserviceapi:getWebServiceSync', e => e.returnValue = webserviceipc.getWebService(e));
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShare', (e, data: string) => webserviceipc.invokeNativeShare(e, data));
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShareUrl', (e, data: string) => webserviceipc.invokeNativeShareUrl(e, data));
    ipcMain.handle('nxapi:webserviceapi:requestGameWebToken', e => webserviceipc.requestGameWebToken(e));
    ipcMain.handle('nxapi:webserviceapi:restorePersistentData', e => webserviceipc.restorePersistentData(e));
    ipcMain.handle('nxapi:webserviceapi:storePersistentData', (e, data: string) => webserviceipc.storePersistentData(e, data));

    store.on('update-nintendo-accounts', () => sendToAllWindows('nxapi:accounts:shouldrefresh'));
    store.on('update-discord-presence-source', () => sendToAllWindows('nxapi:discord:shouldrefresh'));
    store.on('update-discord-presence', (p: DiscordPresence) => sendToAllWindows('nxapi:discord:presence', p));
    store.on('update-discord-user', (u: User) => sendToAllWindows('nxapi:discord:user', u));
}

function sendToAllWindows(channel: string, ...args: any[]) {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, ...args);
    }
}
