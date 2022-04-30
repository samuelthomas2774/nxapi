import { ipcRenderer } from 'electron';
import createDebug from 'debug';
import { WebServiceData } from '../main/webservices.js';

const debug = createDebug('app:preload-webservice:ipc');

const ipc = {
    getWebServiceSync: () => ipcRenderer.sendSync('nxapi:webserviceapi:getWebServiceSync') as WebServiceData,
    invokeNativeShare: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:invokeNativeShare', data) as Promise<void>,
    invokeNativeShareUrl: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:invokeNativeShareUrl', data) as Promise<void>,
    requestGameWebToken: () => ipcRenderer.invoke('nxapi:webserviceapi:requestGameWebToken') as Promise<string>,
    restorePersistentData: () => ipcRenderer.invoke('nxapi:webserviceapi:restorePersistentData') as Promise<string | undefined>,
    storePersistentData: (data: string) => ipcRenderer.invoke('nxapi:webserviceapi:storePersistentData', data) as Promise<void>,
};

export default ipc;

export const {webservice, url: webserviceurl} = ipc.getWebServiceSync();

debug('Web service', webservice);
debug('Web service URL', webserviceurl);
