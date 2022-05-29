import type { EventEmitter } from 'node:events';
import createDebug from 'debug';
import type { NxapiElectronIpc } from '../preload/index.js';

const debug = createDebug('app:browser:ipc');

declare global {
    interface Window {
        nxapiElectronIpc: NxapiElectronIpc;
    }
}

const ipc = window.nxapiElectronIpc;

export default ipc;

export const config = ipc.getWindowData();

debug('Window configuration', config);
