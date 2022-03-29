import type { NxapiElectronIpc } from '../preload/index.js';

declare global {
    interface Window {
        nxapiElectronIpc: NxapiElectronIpc;
    }
}

const ipc = window.nxapiElectronIpc;

export default ipc;
