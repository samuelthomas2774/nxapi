import { ipcRenderer, IpcRendererEvent } from 'electron';
import { EventEmitter } from 'node:events';
import createDebug from 'debug';
import { QrCodeReaderOptions, WebServiceData } from '../main/webservices.js';

const debug = createDebug('app:preload-webservice:ipc');

export const events = new EventEmitter();

const ipc = {
    getWebServiceSync: () => ipcRenderer.sendSync('nxapi:webserviceapi:getWebServiceSync') as WebServiceData,
    invokeNativeShare: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:invokeNativeShare', data) as Promise<void>,
    invokeNativeShareUrl: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:invokeNativeShareUrl', data) as Promise<void>,
    requestGameWebToken: () => ipcRenderer.invoke('nxapi:webserviceapi:requestGameWebToken') as Promise<string>,
    restorePersistentData: () => ipcRenderer.invoke('nxapi:webserviceapi:restorePersistentData') as Promise<string | undefined>,
    storePersistentData: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:storePersistentData', data) as Promise<void>,
    openQrCodeReader: (data: QrCodeReaderOptions) => ipcRenderer.invoke('nxapi:webserviceapi:openQrCodeReader', data) as Promise<string>,
    closeQrCodeReader: () => ipcRenderer.invoke('nxapi:webserviceapi:closeQrCodeReader') as Promise<void>,
    sendMessage: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:sendMessage', data) as Promise<void>,
    copyToClipboard: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:copyToClipboard', data) as Promise<void>,
    downloadImages: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:downloadImages', data) as Promise<void>,
    completeLoading: () => ipcRenderer.invoke('nxapi:webserviceapi:completeLoading') as Promise<void>,
};

export default ipc;

export const {webservice, url: webserviceurl} = ipc.getWebServiceSync();

debug('Web service', webservice);
debug('Web service URL', webserviceurl);

ipcRenderer.on('nxapi:window:refresh', () => events.emit('window:refresh') || location.reload());

ipcRenderer.on('nxapi:webserviceapi:deeplink', (event: IpcRendererEvent, qs: string) => {
    if (events.emit('deeplink', qs)) return;

    const url = new URL(webserviceurl);
    url.search += (url.search ? '&' : '') + qs;
    location.href = url.toString();
});
