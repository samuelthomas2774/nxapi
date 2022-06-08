import createDebug from 'debug';

// Logs are written to the browser window developer tools, and are hidden by default (enable verbose logs)
const debug = createDebug('app:preload-webservice');

import './znca-js-api.js';
import './quirks/splatnet2.js';
import './quirks/nooklink.js';

const style = window.document.createElement('style');

style.textContent = `
*:focus-visible {
    outline-style: solid;
    outline-width: medium;
}
`;

document.addEventListener('DOMContentLoaded', () => {
    (document.scrollingElement as HTMLElement).style.overflowX = 'hidden';
    window.document.head.appendChild(style);
});
