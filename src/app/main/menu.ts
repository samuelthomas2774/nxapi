import { app, Menu, Tray, nativeImage, MenuItem, BrowserWindow, KeyboardEvent } from 'electron';
import path from 'node:path';
import { askAddNsoAccount, askAddPctlAccount } from './na-auth.js';
import { App } from './index.js';
import openWebService, { handleOpenWebServiceError, WebServiceValidationError } from './webservices.js';
import { EmbeddedPresenceMonitor, EmbeddedProxyPresenceMonitor } from './monitor.js';
import { createModalWindow } from './windows.js';
import { ApperancePrefrence, WindowType } from '../common/types.js';
import { CoralApiInterface } from '../../api/coral.js';
import { WebService } from '../../api/coral-types.js';
import { SavedToken } from '../../common/auth/coral.js';
import { SavedMoonToken } from '../../common/auth/moon.js';
import { CachedWebServicesList } from '../../common/users.js';
import createDebug from '../../util/debug.js';
import { dev, dir } from '../../util/product.js';
import { MembershipRequiredError } from '../../common/auth/util.js';

const debug = createDebug('app:main:menu');

export default class MenuApp {
    tray: Tray;

    constructor(readonly app: App) {
        const icon = nativeImage
            .createFromPath(path.join(dir, 'resources', 'app', 'menu-icon-dark.png'))
            .resize({height: 16});

        icon.setTemplateImage(true);

        this.tray = new Tray(icon);
        this.tray.setToolTip('nxapi');

        app.store.on('update-nintendo-accounts', () => this.updateMenu());
        app.store.on('update-cached-web-services', (language: string, cache: CachedWebServicesList) => {
            this.webservices.set(language, cache.webservices);
            this.updateMenu();
        });
        this.updateMenu();
        this.updateIcon();
    }

    async updateIcon() {
        const options = await this.app.store.getAppearanceItem();
        let menu_icon = null;

        if (options.statusbar_icon === ApperancePrefrence.DARK) menu_icon = 'menu-icon-dark.png';
        else menu_icon = 'menu-icon-light.png';

        const icon = nativeImage
            .createFromPath(path.join(dir, 'resources', 'app', menu_icon))
            .resize({height: 16});

        icon.setTemplateImage(true);
        this.tray.setImage(icon);
    }

    async updateMenu() {
        const menu = new Menu();

        const ids = await this.app.store.storage.getItem('NintendoAccountIds') as string[] | undefined;
        menu.append(new MenuItem({label: 'Nintendo Switch Online', enabled: false}));

        const discord_presence_monitor = this.getActiveDiscordPresenceMonitor();

        for (const id of ids ?? []) {
            const token = await this.app.store.storage.getItem('NintendoAccountToken.' + id) as string | undefined;
            if (!token) continue;
            const data = await this.app.store.storage.getItem('NsoToken.' + token) as SavedToken | undefined;
            if (!data) continue;

            const monitor = this.app.monitors.monitors.find(m => m instanceof EmbeddedPresenceMonitor &&
                m.data.user.id === data.user.id);
            const discord_presence_active = discord_presence_monitor instanceof EmbeddedPresenceMonitor &&
                discord_presence_monitor?.data?.user.id === data.user.id;

            const webservices = await this.getWebServiceItems(data.user.language, token);

            const item = new MenuItem({
                label: data.nsoAccount.user.name,
                submenu: [
                    {label: 'Nintendo Account ID: ' + data.user.id, enabled: false},
                    {label: 'Coral ID: ' + data.nsoAccount.user.id, enabled: false},
                    {label: 'NSA ID: ' + data.nsoAccount.user.nsaId, enabled: false},
                    {type: 'separator'},
                    {label: 'Enable Discord Presence', type: 'checkbox', checked: discord_presence_active,
                        enabled: discord_presence_active,
                        click: () => this.setActiveDiscordPresenceUser(discord_presence_active ? null : data.user.id)},
                    {label: 'Enable notifications for this user\'s presence', type: 'checkbox',
                        checked: monitor?.user_notifications,
                        enabled: !!monitor?.user_notifications,
                        click: () => this.setUserNotificationsActive(data.user.id, !monitor?.user_notifications)},
                    {label: 'Enable notifications for friends of this user\'s presence', type: 'checkbox',
                        checked: monitor?.friend_notifications,
                        click: () => this.setFriendNotificationsActive(data.user.id, !monitor?.friend_notifications)},
                    {label: 'Update now', enabled: !!monitor, click: () => monitor?.skipIntervalInCurrentLoop(true)},
                    {type: 'separator'},
                    {label: 'Add friend', click: () => this.showAddFriendWindow(data.user.id)},
                    ...(webservices.length ? [
                        {type: 'separator'},
                        {label: 'Web services', enabled: false},
                        ...webservices as any,
                    ] : []),
                ],
            });

            menu.append(item);
        }

        menu.append(new MenuItem({label: 'Add account', click: this.addNsoAccount}));
        menu.append(new MenuItem({type: 'separator'}));
        menu.append(new MenuItem({label: 'Nintendo Switch Parental Controls', enabled: false}));

        for (const id of ids ?? []) {
            const token = await this.app.store.storage.getItem('NintendoAccountToken-pctl.' + id) as string | undefined;
            if (!token) continue;
            const data = await this.app.store.storage.getItem('MoonToken.' + token) as SavedMoonToken | undefined;
            if (!data) continue;

            const item = new MenuItem({
                label: data.user.nickname,
                submenu: [
                    {label: 'Nintendo Account ID: ' + data.user.id, enabled: false},
                ],
            });

            menu.append(item);
        }

        menu.append(new MenuItem({label: 'Add account', click: this.addPctlAccount}));

        menu.append(new MenuItem({type: 'separator'}));
        menu.append(new MenuItem({label: 'Show main window', click: () => this.app.showMainWindow()}));
        menu.append(new MenuItem({label: 'Preferences', click: () => this.app.showPreferencesWindow()}));
        if (dev) menu.append(new MenuItem({label: 'Dump notifications state', click: () => {
            debug('Accounts', this.app.monitors.notifications.accounts);
            debug('Friends', this.app.monitors.notifications.onlinefriends);
        }}));
        menu.append(new MenuItem({label: 'Quit', click: () => app.quit()}));

        this.tray.setContextMenu(menu);
    }
    

    addNsoAccount = (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
        askAddNsoAccount(this.app.store.storage, !event.shiftKey);
    addPctlAccount = (item: MenuItem, window: BrowserWindow | undefined, event: KeyboardEvent) =>
        askAddPctlAccount(this.app.store.storage, !event.shiftKey);

    protected webservices = new Map</** language */ string, WebService[]>();

    async getWebServices(language: string) {
        const cache = this.webservices.get(language);
        if (cache) return cache;

        const webservices: CachedWebServicesList | undefined =
            await this.app.store.storage.getItem('CachedWebServicesList.' + language);

        if (webservices) this.webservices.set(language, webservices.webservices);
        return webservices?.webservices ?? [];
    }

    async getWebServiceItems(language: string, token: string) {
        const webservices = await this.getWebServices(language);
        const items = [];

        for (const webservice of webservices) {
            items.push(new MenuItem({
                label: webservice.name,
                click: async () => {
                    try {
                        const {nso, data} = await this.app.store.users.get(token);

                        await this.openWebService(token, nso, data, webservice);
                    } catch (err) {
                        handleOpenWebServiceError(err, webservice);
                    }
                },
            }));
        }

        return items;
    }

    async openWebService(token: string, coral: CoralApiInterface, data: SavedToken, webservice: WebService) {
        try {
            await openWebService(this.app.store, token, coral, data, webservice);
        } catch (err) {
            if (!(err instanceof WebServiceValidationError) && !(err instanceof MembershipRequiredError)) return;

            handleOpenWebServiceError(err, webservice, undefined, data);
        }
    }

    getActiveDiscordPresenceMonitor() {
        for (const monitor of this.app.monitors.monitors) {
            if (!monitor.presence_enabled) continue;

            return monitor;
        }

        return null;
    }

    async setActiveDiscordPresenceUser(id: string | null) {
        const monitor = this.getActiveDiscordPresenceMonitor();

        if (monitor) {
            if (monitor instanceof EmbeddedPresenceMonitor && monitor.data.user.id === id) return;

            monitor.discord.updatePresenceForDiscord(null);

            if (monitor instanceof EmbeddedPresenceMonitor) {
                monitor.presence_user = null;

                if (!monitor.user_notifications && !monitor.friend_notifications) {
                    this.app.monitors.stop(monitor.data.user.id);
                }
            }

            if (monitor instanceof EmbeddedProxyPresenceMonitor) {
                this.app.monitors.stop(monitor.presence_url);
            }
        }

        if (id) await this.app.monitors.start(id, monitor => {
            monitor.presence_user = monitor.data.nsoAccount.user.nsaId;
            monitor.skipIntervalInCurrentLoop();
        });

        if (monitor || id) this.saveMonitorStateAndUpdateMenu();
    }

    async setUserNotificationsActive(id: string, active: boolean) {
        const monitor = this.app.monitors.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === id);

        if (monitor?.user_notifications && !active) {
            monitor.user_notifications = false;

            if (!monitor.presence_user && !monitor.friend_notifications) {
                this.app.monitors.stop(monitor.data.user.id);
            }

            monitor.skipIntervalInCurrentLoop();
            this.saveMonitorStateAndUpdateMenu();
        }

        if (!monitor?.user_notifications && active) await this.app.monitors.start(id, monitor => {
            monitor.user_notifications = true;
            monitor.skipIntervalInCurrentLoop();
            this.saveMonitorStateAndUpdateMenu();
        });
    }

    async setFriendNotificationsActive(id: string, active: boolean) {
        const monitor = this.app.monitors.monitors.find(m => m instanceof EmbeddedPresenceMonitor && m.data.user.id === id);

        if (monitor?.friend_notifications && !active) {
            monitor.friend_notifications = false;

            if (!monitor.presence_user && !monitor.user_notifications) {
                this.app.monitors.stop(monitor.data.user.id);
            }

            monitor.skipIntervalInCurrentLoop();
            this.saveMonitorStateAndUpdateMenu();
        }

        if (!monitor?.friend_notifications && active) await this.app.monitors.start(id, monitor => {
            monitor.friend_notifications = true;
            monitor.skipIntervalInCurrentLoop();
            this.saveMonitorStateAndUpdateMenu();
        });
    }

    async saveMonitorState() {
        try {
            await this.app.store.saveMonitorState(this.app.monitors);
        } catch (err) {
            debug('Error saving monitor state', err);
        }
    }

    saveMonitorStateAndUpdateMenu() {
        this.saveMonitorState();
        this.updateMenu();
    }

    showAddFriendWindow(user: string) {
        createModalWindow(WindowType.ADD_FRIEND, {
            user,
        });
    }
}
