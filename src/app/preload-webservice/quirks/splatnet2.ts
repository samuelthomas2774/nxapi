import createDebug from 'debug';
import { events, webservice } from '../ipc.js';

const debug = createDebug('app:preload-webservice:quirks:splatnet2');

const SPLATNET2_WEBSERVICE_ID = 5741031244955648;

if (webservice.id === SPLATNET2_WEBSERVICE_ID) {
    events.on('window:refresh', () => {
        const refresh_button = document.querySelector<HTMLElement>('.refresh-button');

        if (refresh_button) {
            refresh_button.click();
        } else {
            location.reload();
        }
    });
}
