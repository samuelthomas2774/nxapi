import { contextBridge, ipcRenderer } from 'electron';
import * as process from 'node:process';
import { EventEmitter } from 'node:events';
import createDebug from 'debug';
import type { DiscordPresenceSource, WindowConfiguration } from '../common/types.js';
import type { SavedToken } from '../../common/auth/nso.js';
import type { SavedMoonToken } from '../../common/auth/moon.js';
import type { UpdateCacheData } from '../../common/update.js';
import { Announcements, CurrentUser, Friend, GetActiveEventResult, WebService, WebServices } from '../../api/znc-types.js';
import { DiscordPresence } from '../../discord/util.js';
import { User } from 'discord-rpc';
import { SharingItem } from '../main/electron.js';
import { NintendoAccountUser } from '../../api/na.js';

const debug = createDebug('app:preload');

const inv = <T = void>(channel: string, ...args: any[]) =>
    ipcRenderer.invoke('nxapi:' + channel, ...args) as Promise<T>;
const invSync = <T = void>(channel: string, ...args: any[]) =>
    ipcRenderer.sendSync('nxapi:' + channel, ...args) as T;

const events = new EventEmitter();
events.setMaxListeners(0);

const ipc = {
    getWindowData: () => invSync<WindowConfiguration>('browser:getwindowdata'),

    getUpdateData: () => inv<UpdateCacheData | null>('update:get'),
    checkUpdates: () => inv<UpdateCacheData | null>('update:check'),

    listNintendoAccounts: () => inv<string[] | undefined>('accounts:list'),
    addNsoAccount: () => inv<string>('accounts:add-coral'),
    addMoonAccount: () => inv<string>('accounts:add-moon'),

    getNintendoAccountNsoToken: (id: string) => inv<string | undefined>('nso:gettoken', id),
    getSavedNsoToken: (token: string) => inv<SavedToken | undefined>('nso:getcachedtoken', token),
    getNsoAnnouncements: (token: string) => inv<Announcements>('nso:announcements', token),
    getNsoFriends: (token: string) => inv<Friend[]>('nso:friends', token),
    getNsoWebServices: (token: string) => inv<WebServices | undefined>('nso:webservices', token),
    openWebService: (webservice: WebService, token: string, qs?: string) => inv<number>('nso:openwebservice', webservice, token, qs),
    getNsoActiveEvent: (token: string) => inv<GetActiveEventResult>('nso:activeevent', token),

    getDiscordPresenceSource: () => inv<DiscordPresenceSource | null>('discord:source'),
    setDiscordPresenceSource: (source: DiscordPresenceSource | null) => inv<void>('discord:setsource', source),
    getDiscordPresence: () => inv<DiscordPresence | null>('discord:presence'),
    getDiscordUser: () => inv<User | null>('discord:user'),

    getNintendoAccountMoonToken: (id: string) => inv<string | undefined>('moon:gettoken', id),
    getSavedMoonToken: (token: string) => inv<SavedMoonToken | undefined>('moon:getcachedtoken', token),

    showFriendModal: (na_id: string, nsa_id: string) => inv<number>('window:showfriend', na_id, nsa_id),
    showDiscordModal: () => inv<number>('window:discord'),
    setWindowHeight: (height: number) => inv('window:setheight', height),

    openExternalUrl: (url: string) => inv('misc:open-url', url),
    share: (item: SharingItem) => inv('misc:share', item),

    showUserMenu: (user: NintendoAccountUser, nso?: CurrentUser, moon?: boolean) => inv('menu:user', user, nso, moon),
    showAddUserMenu: () => inv('menu:add-user'),
    showFriendCodeMenu: (fc: CurrentUser['links']['friendCode']) => inv('menu:friend-code', fc),
    showFriendMenu: (user: NintendoAccountUser, nso: CurrentUser, friend: Friend) => inv('menu:friend', user, nso, friend),

    registerEventListener: (event: string, listener: (args: any[]) => void) => events.on(event, listener),
    removeEventListener: (event: string, listener: (args: any[]) => void) => events.removeListener(event, listener),

    getAccentColour: () => accent_colour,
};

export type NxapiElectronIpc = typeof ipc;

ipcRenderer.on('nxapi:window:refresh', () => events.emit('window:refresh') || location.reload());
ipcRenderer.on('nxapi:accounts:shouldrefresh', () => events.emit('update-nintendo-accounts'));
ipcRenderer.on('nxapi:discord:shouldrefresh', () => events.emit('update-discord-presence-source'));
ipcRenderer.on('nxapi:discord:presence', (e, p: DiscordPresence) => events.emit('update-discord-presence', p));
ipcRenderer.on('nxapi:discord:user', (e, u: User) => events.emit('update-discord-user', u));

let accent_colour: string | undefined = invSync('systemPreferences:accent-colour');
ipcRenderer.on('nxapi:systemPreferences:accent-colour', (event, c) => {
    accent_colour = c;
    events.emit('systemPreferences:accent-colour', c);
});

contextBridge.exposeInMainWorld('nxapiElectronIpc', ipc);
