import { BrowserWindow, clipboard, dialog, IpcMain, KeyboardEvent, Menu, MenuItem, ShareMenu, SharingItem, shell, systemPreferences } from './electron.js';
import * as util from 'node:util';
import { User } from 'discord-rpc';
import openWebService, { QrCodeReaderOptions, WebServiceIpc, WebServiceValidationError } from './webservices.js';
import { createModalWindow, createWindow, getWindowConfiguration, setWindowHeight } from './windows.js';
import { askAddNsoAccount, askAddPctlAccount } from './na-auth.js';
import { App } from './index.js';
import { EmbeddedPresenceMonitor } from './monitor.js';
import { DiscordPresenceConfiguration, DiscordPresenceSource, LoginItemOptions, WindowType } from '../common/types.js';
import { CurrentUser, Friend, Game, PresenceState, WebService } from '../../api/coral-types.js';
import { NintendoAccountUser } from '../../api/na.js';
import createDebug from '../../util/debug.js';
import { DiscordPresence } from '../../discord/types.js';
import { getDiscordRpcClients } from '../../discord/rpc.js';
import { defaultTitle } from '../../discord/titles.js';
import type { FriendProps } from '../browser/friend/index.js';
import type { DiscordSetupProps } from '../browser/discord/index.js';
import type { AddFriendProps } from '../browser/add-friend/index.js';

const debug = createDebug('app:main:ipc');

export function setupIpc(appinstance: App, ipcMain: IpcMain) {
    const store = appinstance.store;
    const storage = appinstance.store.storage;
    const t = appinstance.i18n.getFixedT(null, 'menus');

    ipcMain.on('nxapi:browser:getwindowdata', e => e.returnValue = getWindowConfiguration(e.sender));
    ipcMain.on('nxapi:app:language', e => e.returnValue = appinstance.i18n.resolvedLanguage ?? appinstance.i18n.language);

    let accent_colour = systemPreferences.getAccentColor?.() || undefined;

    ipcMain.on('nxapi:systemPreferences:accent-colour', e => e.returnValue = accent_colour);
    systemPreferences.subscribeLocalNotification?.('NSSystemColorsDidChangeNotification', (event, userInfo, object) => {
        accent_colour = systemPreferences.getAccentColor?.();
        sendToAllWindows('nxapi:systemPreferences:accent-colour', accent_colour);
    });
    systemPreferences.on('accent-color-changed', (event, new_colour) => {
        accent_colour = new_colour ?? systemPreferences.getAccentColor?.();
        sendToAllWindows('nxapi:systemPreferences:accent-colour', accent_colour);
    });

    ipcMain.handle('nxapi:systemPreferences:getloginitem', () => appinstance.store.getLoginItem());
    ipcMain.handle('nxapi:systemPreferences:setloginitem', (e, settings: LoginItemOptions) => appinstance.store.setLoginItem(settings));

    ipcMain.handle('nxapi:update:get', () => appinstance.updater.cache ?? appinstance.updater.check());
    ipcMain.handle('nxapi:update:check', () => appinstance.updater.check());

    setTimeout(async () => {
        const update = await appinstance.updater.check();
        if (update) sendToAllWindows('nxapi:update:latest', update);
    }, 60 * 60 * 1000);

    ipcMain.handle('nxapi:accounts:list', () => storage.getItem('NintendoAccountIds'));
    ipcMain.handle('nxapi:accounts:add-coral', () => askAddNsoAccount(store.storage).then(u => u?.data.user.id));
    ipcMain.handle('nxapi:accounts:add-moon', () => askAddPctlAccount(store.storage).then(u => u?.data.user.id));

    ipcMain.handle('nxapi:coral:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken.' + id));
    ipcMain.handle('nxapi:coral:getcachedtoken', (e, token: string) => storage.getItem('NsoToken.' + token));
    ipcMain.handle('nxapi:coral:announcements', (e, token: string) => store.users.get(token).then(u => u.announcements.result));
    ipcMain.handle('nxapi:coral:friends', (e, token: string) => store.users.get(token).then(u => u.getFriends()));
    ipcMain.handle('nxapi:coral:webservices', (e, token: string) => store.users.get(token).then(u => u.getWebServices()));
    ipcMain.handle('nxapi:coral:openwebservice', (e, webservice: WebService, token: string, qs?: string) =>
        store.users.get(token).then(u => openWebService(store, token, u.nso, u.data, webservice, qs)
            .catch(err => err instanceof WebServiceValidationError ? dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender)!, {
                type: 'error',
                message: (err instanceof Error ? err.name : 'Error') + ' opening web service',
                detail: (err instanceof Error ? err.stack ?? err.message : err) + '\n\n' + util.inspect({
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
            }) : null)));
    ipcMain.handle('nxapi:coral:activeevent', (e, token: string) => store.users.get(token).then(u => u.getActiveEvent()));
    ipcMain.handle('nxapi:coral:friendcodeurl', (e, token: string) => store.users.get(token).then(u => u.nso.getFriendCodeUrl()));
    ipcMain.handle('nxapi:coral:friendcode', (e, token: string, friendcode: string, hash?: string) => store.users.get(token).then(u => u.nso.getUserByFriendCode(friendcode, hash)));
    ipcMain.handle('nxapi:coral:addfriend', (e, token: string, nsaid: string) => store.users.get(token).then(u => u.addFriend(nsaid)));

    ipcMain.handle('nxapi:window:showpreferences', () => appinstance.showPreferencesWindow().id);
    ipcMain.handle('nxapi:window:showfriend', (e, props: FriendProps) =>
        createModalWindow(WindowType.FRIEND, props, e.sender).id);
    ipcMain.handle('nxapi:window:discord', (e, props: DiscordSetupProps) =>
        createModalWindow(WindowType.DISCORD_PRESENCE, props).id);
    ipcMain.handle('nxapi:window:addfriend', (e, props: AddFriendProps) =>
        createModalWindow(WindowType.ADD_FRIEND, props, e.sender).id);
    ipcMain.handle('nxapi:window:setheight', (e, height: number) => {
        const window = BrowserWindow.fromWebContents(e.sender)!;
        setWindowHeight(window, height);
    });

    ipcMain.handle('nxapi:discord:config', () => appinstance.monitors.getDiscordPresenceConfiguration());
    ipcMain.handle('nxapi:discord:setconfig', (e, config: DiscordPresenceConfiguration | null) => appinstance.monitors.setDiscordPresenceConfiguration(config));
    ipcMain.handle('nxapi:discord:options', () => appinstance.monitors.getActiveDiscordPresenceOptions() ?? appinstance.store.getSavedDiscordPresenceOptions());
    ipcMain.handle('nxapi:discord:savedoptions', () => appinstance.store.getSavedDiscordPresenceOptions());
    ipcMain.handle('nxapi:discord:setoptions', (e, options: Omit<DiscordPresenceConfiguration, 'source'>) => appinstance.monitors.setDiscordPresenceOptions(options));
    ipcMain.handle('nxapi:discord:source', () => appinstance.monitors.getDiscordPresenceSource());
    ipcMain.handle('nxapi:discord:setsource', (e, source: DiscordPresenceSource | null) => appinstance.monitors.setDiscordPresenceSource(source));
    ipcMain.handle('nxapi:discord:presence', () => appinstance.monitors.getDiscordPresence());
    ipcMain.handle('nxapi:discord:user', () => appinstance.monitors.getActiveDiscordPresenceMonitor()?.discord.rpc?.client.user ?? null);
    ipcMain.handle('nxapi:discord:users', async () => {
        const users: User[] = [];

        for (const client of await getDiscordRpcClients()) {
            try {
                await client.connect(defaultTitle.client);
                if (client.user && !users.find(u => u.id === client.user!.id)) users.push(client.user);
            } finally {
                await client.destroy();
            }
        }

        return users;
    });

    ipcMain.handle('nxapi:moon:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken-pctl.' + id));
    ipcMain.handle('nxapi:moon:getcachedtoken', (e, token: string) => storage.getItem('MoonToken.' + token));

    ipcMain.handle('nxapi:misc:open-url', (e, url: string) => shell.openExternal(url));
    ipcMain.handle('nxapi:misc:share', (e, item: SharingItem) =>
        new ShareMenu(item).popup({window: BrowserWindow.fromWebContents(e.sender)!}));

    ipcMain.handle('nxapi:menu:user', (e, user: NintendoAccountUser, nso?: CurrentUser, moon?: boolean) =>
        (buildUserMenu(appinstance, user, nso, moon, BrowserWindow.fromWebContents(e.sender) ?? undefined)
            .popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    ipcMain.handle('nxapi:menu:add-user', e => (Menu.buildFromTemplate([
        new MenuItem({label: t('add_account.add_account_coral')!, click:
            (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
                askAddNsoAccount(storage, !event.shiftKey)}),
        new MenuItem({label: t('add_account.add_account_moon')!, click:
            (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
                askAddPctlAccount(storage, !event.shiftKey)}),
    ]).popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    ipcMain.handle('nxapi:menu:friend-code', (e, fc: CurrentUser['links']['friendCode']) => (Menu.buildFromTemplate([
        new MenuItem({label: 'SW-' + fc.id, enabled: false}),
        new MenuItem({label: t('friend_code.share')!, role: 'shareMenu', sharingItem: {texts: ['SW-' + fc.id]}}),
        new MenuItem({label: t('friend_code.copy')!, click: () => clipboard.writeText('SW-' + fc.id)}),
        new MenuItem({type: 'separator'}),
        new MenuItem({label: fc.regenerable ? t('friend_code.friend_code_regenerable')! :
            t('friend_code.friend_code_regenerable_at', {
                date: new Date(fc.regenerableAt * 1000),
                formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
            })!, enabled: false}),
    ]).popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    ipcMain.handle('nxapi:menu:friend', (e, user: NintendoAccountUser, nso: CurrentUser, friend: Friend) =>
        (buildFriendMenu(appinstance, user, nso, friend)
            .popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));

    const webserviceipc = new WebServiceIpc(store);
    ipcMain.on('nxapi:webserviceapi:getWebServiceSync', e => e.returnValue = webserviceipc.getWebService(e));
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShare', (e, data: string) => webserviceipc.invokeNativeShare(e, data));
    ipcMain.handle('nxapi:webserviceapi:invokeNativeShareUrl', (e, data: string) => webserviceipc.invokeNativeShareUrl(e, data));
    ipcMain.handle('nxapi:webserviceapi:requestGameWebToken', e => webserviceipc.requestGameWebToken(e));
    ipcMain.handle('nxapi:webserviceapi:restorePersistentData', e => webserviceipc.restorePersistentData(e));
    ipcMain.handle('nxapi:webserviceapi:storePersistentData', (e, data: string) => webserviceipc.storePersistentData(e, data));
    ipcMain.handle('nxapi:webserviceapi:openQrCodeReader', (e, data: QrCodeReaderOptions) => webserviceipc.openQrCodeReader(e, data));
    ipcMain.handle('nxapi:webserviceapi:closeQrCodeReader', e => webserviceipc.closeQrCodeReader(e));
    ipcMain.handle('nxapi:webserviceapi:sendMessage', (e, data: string) => webserviceipc.sendMessage(e, data));
    ipcMain.handle('nxapi:webserviceapi:copyToClipboard', (e, data: string) => webserviceipc.copyToClipboard(e, data));
    ipcMain.handle('nxapi:webserviceapi:downloadImages', (e, data: string) => webserviceipc.downloadImages(e, data));
    ipcMain.handle('nxapi:webserviceapi:completeLoading', e => webserviceipc.completeLoading(e));

    store.on('update-nintendo-accounts', () => sendToAllWindows('nxapi:accounts:shouldrefresh'));
    store.on('update-discord-presence-source', () => sendToAllWindows('nxapi:discord:shouldrefresh'));
    store.on('update-discord-presence', (p: DiscordPresence) => sendToAllWindows('nxapi:discord:presence', p));
    store.on('update-discord-user', (u: User) => sendToAllWindows('nxapi:discord:user', u));
}

export function sendToAllWindows(channel: string, ...args: any[]) {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, ...args);
    }
}

function buildUserMenu(app: App, user: NintendoAccountUser, nso?: CurrentUser, moon?: boolean, window?: BrowserWindow) {
    const t = app.i18n.getFixedT(null, 'menus', 'user');
    const dm = app.monitors.getActiveDiscordPresenceMonitor();
    const monitor = app.monitors.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === user.id);

    return Menu.buildFromTemplate([
        new MenuItem({label: t('na_id', {id: user.id})!, enabled: false}),
        ...(nso ? [
            new MenuItem({label: t('coral_id', {id: nso.id})!, enabled: false}),
            new MenuItem({label: t('nsa_id', {id: nso.nsaId})!, enabled: false}),
            new MenuItem({type: 'separator'}),
            ...(monitor?.presence_user === nso.nsaId ? [
                new MenuItem({label: t('discord_disable')!,
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : monitor?.presence_user ? [
                new MenuItem({label: t('discord_enabled_for', {name: 
                    monitor.user?.friends.result.friends.find(f => f.nsaId === monitor.presence_user)?.name ??
                        monitor.presence_user})!,
                    enabled: false}),
                new MenuItem({label: t('discord_disable')!,
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : dm?.presence_user === nso.nsaId ? [
                new MenuItem({label: t('discord_enabled_via', {name:
                    dm.data.user.nickname +
                    (dm.data.user.nickname !== dm.data.nsoAccount.user.name ?
                        '/' + dm.data.nsoAccount.user.name : '')})!,
                    enabled: false}),
                new MenuItem({label: t('discord_disable')!,
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : [
                new MenuItem({label: t('discord_enable')!,
                    click: () => createModalWindow(WindowType.DISCORD_PRESENCE, {
                        friend_nsa_id: nso.nsaId,
                    }, window)}),
            ]),
            new MenuItem({label: t('friend_notifications_enable')!, type: 'checkbox',
                checked: monitor?.friend_notifications,
                click: () => app.menu?.setFriendNotificationsActive(user.id, !monitor?.friend_notifications)}),
            new MenuItem({label: t('refresh')!, enabled: !!monitor,
                click: () => monitor?.skipIntervalInCurrentLoop(true)}),
            new MenuItem({type: 'separator'}),
            new MenuItem({label: t('add_friend')!,
                click: () => createModalWindow(WindowType.ADD_FRIEND, {
                    user: user.id,
                }, window)}),
        ] : []),
        new MenuItem({type: 'separator'}),
        new MenuItem({label: t('remove_help')!, enabled: false}),
    ]);
}

function buildFriendMenu(app: App, user: NintendoAccountUser, nso: CurrentUser, friend: Friend) {
    const t = app.i18n.getFixedT(null, 'menus', 'friend');
    const discord_presence_source = app.monitors.getDiscordPresenceSource();
    const discord_presence_active = !!discord_presence_source && 'na_id' in discord_presence_source &&
        discord_presence_source.na_id === user.id && discord_presence_source.friend_nsa_id === friend.nsaId;

    return Menu.buildFromTemplate([
        ...(!friend.presence.updatedAt ? [
        ] : friend.presence.state === PresenceState.ONLINE || friend.presence.state === PresenceState.PLAYING ? [
            new MenuItem({label: t('presence_online')!, enabled: false}),
            ...('name' in friend.presence.game ? [
                new MenuItem({label: friend.presence.game.name, click: () =>
                    shell.openExternal((friend.presence.game as Game).shopUri)}),
                ...(friend.presence.game.sysDescription ? [
                    new MenuItem({label: friend.presence.game.sysDescription, enabled: false}),
                ] : []),
                new MenuItem({label: t('game_first_played', {
                    date: new Date(friend.presence.game.firstPlayedAt * 1000),
                    formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                })!, enabled: false}),
                new MenuItem({label: friend.presence.game.totalPlayTime >= 60 ?
                    friend.presence.game.totalPlayTime % 60 ?
                        t('game_play_time_hm', {hours: Math.floor(friend.presence.game.totalPlayTime / 60),
                            minutes: friend.presence.game.totalPlayTime % 60})! :
                        t('game_play_time_h', {hours: friend.presence.game.totalPlayTime / 60})! :
                    t('game_play_time_m', {minutes: friend.presence.game.totalPlayTime})!, enabled: false}),
            ] : []),
            new MenuItem({label: t('presence_updated', {
                date: new Date(friend.presence.updatedAt * 1000),
                formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
            })!, enabled: false}),
            new MenuItem({type: 'separator'}),
        ] : friend.presence.state === PresenceState.INACTIVE ? [
            new MenuItem({label: t('presence_inactive')!, enabled: false}),
            ...(friend.presence.logoutAt ? [
                new MenuItem({label: t('presence_logout_time', {
                    date: new Date(friend.presence.logoutAt * 1000),
                    formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                })!, enabled: false}),
            ] : []),
            new MenuItem({label: t('presence_updated', {
                date: new Date(friend.presence.updatedAt * 1000),
                formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
            })!, enabled: false}),
            new MenuItem({type: 'separator'}),
        ] : [
            new MenuItem({label: 'Offline', enabled: false}),
            ...(friend.presence.logoutAt ? [
                new MenuItem({label: t('presence_logout_time', {
                    date: new Date(friend.presence.logoutAt * 1000),
                    formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                })!, enabled: false}),
            ] : []),
            new MenuItem({label: t('presence_updated', {
                date: new Date(friend.presence.updatedAt * 1000),
                formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
            })!, enabled: false}),
            new MenuItem({type: 'separator'}),
        ]),
        new MenuItem({label: t('discord_presence_enable')!, type: 'checkbox', checked: discord_presence_active, click: () =>
            app.monitors.setDiscordPresenceSource(discord_presence_active ? null :
                {na_id: user.id, friend_nsa_id: friend.nsaId})}),
    ]);
}
