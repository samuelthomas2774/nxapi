import { BrowserWindow, clipboard, IpcMain, IpcMainInvokeEvent, KeyboardEvent, Menu, MenuItem, ShareMenu, SharingItem, shell, systemPreferences } from './electron.js';
import { User } from 'discord-rpc';
import openWebService, { handleOpenWebServiceError, QrCodeReaderOptions, WebServiceIpc, WebServiceValidationError } from './webservices.js';
import { createModalWindow, getWindowConfiguration, setWindowHeight } from './windows.js';
import { askAddNsoAccount, askAddPctlAccount } from './na-auth.js';
import { App } from './index.js';
import { EmbeddedPresenceMonitor } from './monitor.js';
import { DiscordPresenceConfiguration, DiscordPresenceSource, LoginItemOptions, WindowType } from '../common/types.js';
import { CurrentUser, Friend, Game, PresenceState, WebService } from '../../api/coral-types.js';
import { NintendoAccountUser } from '../../api/na.js';
import createDebug from '../../util/debug.js';
import { hrduration } from '../../util/misc.js';
import { DiscordPresence } from '../../discord/types.js';
import { getDiscordRpcClients } from '../../discord/rpc.js';
import { defaultTitle } from '../../discord/titles.js';
import type { FriendProps } from '../browser/friend/index.js';
import type { DiscordSetupProps } from '../browser/discord/index.js';
import type { AddFriendProps } from '../browser/add-friend/index.js';
import { MembershipRequiredError } from '../../common/auth/util.js';
import { ErrorDescription, ErrorDescriptionSymbol, HasErrorDescription } from '../../util/errors.js';

const debug = createDebug('app:main:ipc');

export function setupIpc(appinstance: App, ipcMain: IpcMain) {
    const store = appinstance.store;
    const storage = appinstance.store.storage;

    ipcMain.on('nxapi:browser:getwindowdata', e => e.returnValue = getWindowConfiguration(e.sender));

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

    const handle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) => ipcMain.handle('nxapi:' + channel, async (event, ...args) => {
        try {
            return {result: await listener.call(null, event, ...args)};
        } catch (err) {
            debug('Error invoking IPC method', channel, err);

            if (!(err instanceof Error)) err = new Error(ErrorDescription.getErrorDescription(err));

            const description = err instanceof HasErrorDescription ? err[ErrorDescriptionSymbol] : null;

            return {
                error_type: (err as Error).constructor.name,
                message: (err as Error).message,
                type: description?.type,
                description: ErrorDescription.getErrorDescription(err),
                data: err,
            };
        }
    });

    handle('systemPreferences:getloginitem', () => appinstance.store.getLoginItem());
    handle('systemPreferences:setloginitem', (e, settings: LoginItemOptions) => appinstance.store.setLoginItem(settings));

    handle('update:get', () => appinstance.updater.cache ?? appinstance.updater.check());
    handle('update:check', () => appinstance.updater.check());

    setTimeout(async () => {
        const update = await appinstance.updater.check();
        if (update) sendToAllWindows('nxapi:update:latest', update);
    }, 60 * 60 * 1000);

    handle('accounts:list', () => storage.getItem('NintendoAccountIds'));
    handle('accounts:add-coral', () => askAddNsoAccount(store.storage).then(u => u?.data.user.id));
    handle('accounts:add-moon', () => askAddPctlAccount(store.storage).then(u => u?.data.user.id));

    handle('coral:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken.' + id));
    handle('coral:getcachedtoken', (e, token: string) => storage.getItem('NsoToken.' + token));
    handle('coral:announcements', (e, token: string) => store.users.get(token).then(u => u.announcements.result));
    handle('coral:friends', (e, token: string) => store.users.get(token).then(u => u.getFriends()));
    handle('coral:webservices', (e, token: string) => store.users.get(token).then(u => u.getWebServices()));
    handle('coral:openwebservice', (e, webservice: WebService, token: string, qs?: string) =>
        store.users.get(token).then(u => openWebService(store, token, u.nso, u.data, webservice, qs)
            .catch(err => err instanceof WebServiceValidationError || err instanceof MembershipRequiredError ?
                handleOpenWebServiceError(err, webservice, qs, u.data, BrowserWindow.fromWebContents(e.sender)!) :
                null)));
    handle('coral:activeevent', (e, token: string) => store.users.get(token).then(u => u.getActiveEvent()));
    handle('coral:friendcodeurl', (e, token: string) => store.users.get(token).then(u => u.nso.getFriendCodeUrl()));
    handle('coral:friendcode', (e, token: string, friendcode: string, hash?: string) => store.users.get(token).then(u => u.nso.getUserByFriendCode(friendcode, hash)));
    handle('coral:addfriend', (e, token: string, nsaid: string) => store.users.get(token).then(u => u.addFriend(nsaid)));

    handle('window:showpreferences', () => appinstance.showPreferencesWindow().id);
    handle('window:showfriend', (e, props: FriendProps) =>
        createModalWindow(WindowType.FRIEND, props, e.sender).id);
    handle('window:discord', (e, props: DiscordSetupProps) =>
        createModalWindow(WindowType.DISCORD_PRESENCE, props).id);
    handle('window:addfriend', (e, props: AddFriendProps) =>
        createModalWindow(WindowType.ADD_FRIEND, props, e.sender).id);
    handle('window:setheight', (e, height: number) => {
        const window = BrowserWindow.fromWebContents(e.sender)!;
        setWindowHeight(window, height);
    });

    handle('discord:config', () => appinstance.monitors.getDiscordPresenceConfiguration());
    handle('discord:setconfig', (e, config: DiscordPresenceConfiguration | null) => appinstance.monitors.setDiscordPresenceConfiguration(config));
    handle('discord:options', () => appinstance.monitors.getActiveDiscordPresenceOptions() ?? appinstance.store.getSavedDiscordPresenceOptions());
    handle('discord:savedoptions', () => appinstance.store.getSavedDiscordPresenceOptions());
    handle('discord:setoptions', (e, options: Omit<DiscordPresenceConfiguration, 'source'>) => appinstance.monitors.setDiscordPresenceOptions(options));
    handle('discord:source', () => appinstance.monitors.getDiscordPresenceSource());
    handle('discord:setsource', (e, source: DiscordPresenceSource | null) => appinstance.monitors.setDiscordPresenceSource(source));
    handle('discord:presence', () => appinstance.monitors.getDiscordPresence());
    handle('discord:user', () => appinstance.monitors.getActiveDiscordPresenceMonitor()?.discord.rpc?.client.user ?? null);
    handle('discord:users', async () => {
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

    handle('moon:gettoken', (e, id: string) => storage.getItem('NintendoAccountToken-pctl.' + id));
    handle('moon:getcachedtoken', (e, token: string) => storage.getItem('MoonToken.' + token));

    handle('misc:open-url', (e, url: string) => shell.openExternal(url));
    handle('misc:share', (e, item: SharingItem) =>
        new ShareMenu(item).popup({window: BrowserWindow.fromWebContents(e.sender)!}));

    handle('menu:user', (e, user: NintendoAccountUser, nso?: CurrentUser, moon?: boolean) =>
        (buildUserMenu(appinstance, user, nso, moon, BrowserWindow.fromWebContents(e.sender) ?? undefined)
            .popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    handle('menu:add-user', e => (Menu.buildFromTemplate([
        new MenuItem({label: 'Add Nintendo Switch Online account', click:
            (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
                askAddNsoAccount(storage, !event.shiftKey)}),
        new MenuItem({label: 'Add Nintendo Switch Parental Controls account', click:
            (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
                askAddPctlAccount(storage, !event.shiftKey)}),
    ]).popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    handle('menu:friend-code', (e, fc: CurrentUser['links']['friendCode']) => (Menu.buildFromTemplate([
        new MenuItem({label: 'SW-' + fc.id, enabled: false}),
        new MenuItem({label: 'Share', role: 'shareMenu', sharingItem: {texts: ['SW-' + fc.id]}}),
        new MenuItem({label: 'Copy', click: () => clipboard.writeText('SW-' + fc.id)}),
        new MenuItem({type: 'separator'}),
        new MenuItem({label: fc.regenerable ? 'Regenerate using a Nintendo Switch console' :
            'Can be regenerated at ' + new Date(fc.regenerableAt * 1000).toLocaleString('en-GB'), enabled: false}),
    ]).popup({window: BrowserWindow.fromWebContents(e.sender)!}), undefined));
    handle('menu:friend', (e, user: NintendoAccountUser, nso: CurrentUser, friend: Friend) =>
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

function sendToAllWindows(channel: string, ...args: any[]) {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, ...args);
    }
}

function buildUserMenu(app: App, user: NintendoAccountUser, nso?: CurrentUser, moon?: boolean, window?: BrowserWindow) {
    const dm = app.monitors.getActiveDiscordPresenceMonitor();
    const monitor = app.monitors.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === user.id);

    return Menu.buildFromTemplate([
        new MenuItem({label: 'Nintendo Account ID: ' + user.id, enabled: false}),
        ...(nso ? [
            new MenuItem({label: 'Coral ID: ' + nso.id, enabled: false}),
            new MenuItem({label: 'NSA ID: ' + nso.nsaId, enabled: false}),
            new MenuItem({type: 'separator'}),
            ...(monitor?.presence_user === nso.nsaId ? [
                new MenuItem({label: 'Disable Discord presence',
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : monitor?.presence_user ? [
                new MenuItem({label: 'Discord presence enabled for ' +
                    monitor.user?.friends.result.friends.find(f => f.nsaId === monitor.presence_user)?.name ??
                        monitor.presence_user,
                    enabled: false}),
                new MenuItem({label: 'Disable Discord presence',
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : dm?.presence_user === nso.nsaId ? [
                new MenuItem({label: 'Discord presence enabled using ' +
                    dm.data.user.nickname +
                    (dm.data.user.nickname!==  dm.data.nsoAccount.user.name ? '/' + dm.data.nsoAccount.user.name : ''),
                    enabled: false}),
                new MenuItem({label: 'Disable Discord presence',
                    click: () => app.menu?.setActiveDiscordPresenceUser(null)}),
            ] : [
                new MenuItem({label: 'Enable Discord presence for this user...',
                    click: () => createModalWindow(WindowType.DISCORD_PRESENCE, {
                        friend_nsa_id: nso.nsaId,
                    }, window)}),
            ]),
            new MenuItem({label: 'Enable friend notifications', type: 'checkbox',
                checked: monitor?.friend_notifications,
                click: () => app.menu?.setFriendNotificationsActive(user.id, !monitor?.friend_notifications)}),
            new MenuItem({label: 'Update now', enabled: !!monitor,
                click: () => monitor?.skipIntervalInCurrentLoop(true)}),
            new MenuItem({type: 'separator'}),
            new MenuItem({label: 'Add friend',
                click: () => createModalWindow(WindowType.ADD_FRIEND, {
                    user: user.id,
                }, window)}),
        ] : []),
        new MenuItem({type: 'separator'}),
        new MenuItem({label: 'Use the nxapi command to remove this user', enabled: false}),
    ]);
}

function buildFriendMenu(app: App, user: NintendoAccountUser, nso: CurrentUser, friend: Friend) {
    const discord_presence_source = app.monitors.getDiscordPresenceSource();
    const discord_presence_active = !!discord_presence_source && 'na_id' in discord_presence_source &&
        discord_presence_source.na_id === user.id && discord_presence_source.friend_nsa_id === friend.nsaId;

    return Menu.buildFromTemplate([
        ...(!friend.presence.updatedAt ? [
        ] : friend.presence.state === PresenceState.ONLINE || friend.presence.state === PresenceState.PLAYING ? [
            new MenuItem({label: 'Online', enabled: false}),
            ...('name' in friend.presence.game ? [
                new MenuItem({label: friend.presence.game.name, click: () =>
                    shell.openExternal((friend.presence.game as Game).shopUri)}),
                ...(friend.presence.game.sysDescription ? [
                    new MenuItem({label: friend.presence.game.sysDescription, enabled: false}),
                ] : []),
                new MenuItem({label: 'First played: ' + new Date(friend.presence.game.firstPlayedAt * 1000).toLocaleString('en-GB'), enabled: false}),
                new MenuItem({label: 'Play time: ' + hrduration(friend.presence.game.totalPlayTime), enabled: false}),
            ] : []),
            new MenuItem({label: 'Updated: ' + new Date(friend.presence.updatedAt * 1000).toLocaleString('en-GB'), enabled: false}),
            new MenuItem({type: 'separator'}),
        ] : friend.presence.state === PresenceState.INACTIVE ? [
            new MenuItem({label: 'Offline (console online)', enabled: false}),
            ...(friend.presence.logoutAt ? [
                new MenuItem({label: 'Logout time: ' + new Date(friend.presence.logoutAt * 1000).toLocaleString('en-GB'), enabled: false}),
            ] : []),
            new MenuItem({label: 'Updated: ' + new Date(friend.presence.updatedAt * 1000).toLocaleString('en-GB'), enabled: false}),
            new MenuItem({type: 'separator'}),
        ] : [
            new MenuItem({label: 'Offline', enabled: false}),
            ...(friend.presence.logoutAt ? [
                new MenuItem({label: 'Logout time: ' + new Date(friend.presence.logoutAt * 1000).toLocaleString('en-GB'), enabled: false}),
            ] : []),
            new MenuItem({label: 'Updated: ' + new Date(friend.presence.updatedAt * 1000).toLocaleString('en-GB'), enabled: false}),
            new MenuItem({type: 'separator'}),
        ]),
        new MenuItem({label: 'Enable Discord Presence', type: 'checkbox', checked: discord_presence_active, click: () =>
            app.monitors.setDiscordPresenceSource(discord_presence_active ? null :
                {na_id: user.id, friend_nsa_id: friend.nsaId})}),
    ]);
}
