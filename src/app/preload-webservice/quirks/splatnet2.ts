import createDebug from 'debug';
import { events, webservice } from '../ipc.js';

const debug = createDebug('app:preload-webservice:quirks:splatnet2');

const SPLATNET2_WEBSERVICE_ID = 5741031244955648;

if (webservice.id === SPLATNET2_WEBSERVICE_ID) {
    const style = window.document.createElement('style');

    style.textContent = `
    .popup-dim {
        /* Hide the horizonal scroll bar that only appears during the popup animation */
        overflow-x: hidden;
    }
    `;

    document.addEventListener('DOMContentLoaded', () => {
        // Always show the scroll bar for the document root since no scrollable containers are used anywhere
        (document.scrollingElement as HTMLElement).style.overflowY = 'scroll';
        window.document.head.appendChild(style);
    });

    events.on('window:refresh', () => {
        const refresh_button = document.querySelector<HTMLElement>('.refresh-button');

        if (refresh_button) {
            refresh_button.click();
        } else {
            location.reload();
        }
    });
}
