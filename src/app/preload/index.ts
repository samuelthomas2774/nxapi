import { contextBridge, ipcRenderer } from 'electron';
import { EventEmitter } from 'events';
import { WindowConfiguration } from '../common/types.js';
import { SavedToken } from '../../common/auth/nso.js';
import { SavedMoonToken } from '../../common/auth/moon.js';

const ipc = {
    getWindowData: () => ipcRenderer.sendSync('nxapi:browser:getwindowdata') as WindowConfiguration,

    listNintendoAccounts: () => ipcRenderer.invoke('nxapi:accounts:list') as Promise<string[] | undefined>,
    getNintendoAccountNsoToken: (id: string) => ipcRenderer.invoke('nxapi:nso:gettoken', id) as Promise<string | undefined>,
    getSavedNsoToken: (token: string) => ipcRenderer.invoke('nxapi:nso:getcachedtoken', token) as Promise<SavedToken | undefined>,
    getNintendoAccountMoonToken: (id: string) => ipcRenderer.invoke('nxapi:moon:gettoken', id) as Promise<string | undefined>,
    getSavedMoonToken: (token: string) => ipcRenderer.invoke('nxapi:moon:getcachedtoken', token) as Promise<SavedMoonToken | undefined>,

    events: new EventEmitter(),
};

export type NxapiElectronIpc = typeof ipc;

ipcRenderer.on('nxapi:accounts:shouldrefresh', () => ipc.events.emit('update-nintendo-accounts'));

contextBridge.exposeInMainWorld('nxapiElectronIpc', ipc);
