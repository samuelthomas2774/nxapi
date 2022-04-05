import { contextBridge, ipcRenderer } from 'electron';
import * as EventEmitter from 'events';
import { SavedMoonToken, SavedToken } from '../../util.js';

const ipc = {
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
