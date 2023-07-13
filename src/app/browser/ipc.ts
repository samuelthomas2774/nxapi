import { EventEmitter } from 'node:events';
import createDebug from 'debug';
import type { NxapiElectronIpc } from '../preload/index.js';

const debug = createDebug('app:browser:ipc');

declare global {
    interface Window {
        nxapiElectronIpc: NxapiElectronIpc;
    }
}

export const events = new EventEmitter();
events.setMaxListeners(0);

const ipc = {
    ...window.nxapiElectronIpc,

    events,
};

events.on('newListener', (event: string, listener: (...args: any[]) => void) => {
    ipc.registerEventListener(event, listener);
});
events.on('removeListener', (event: string, listener: (...args: any[]) => void) => {
    ipc.removeEventListener(event, listener);
});

export default ipc;

export const config = ipc.getWindowData();

debug('Window configuration', config);
