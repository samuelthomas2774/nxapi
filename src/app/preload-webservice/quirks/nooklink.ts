import createDebug from 'debug';
import { webservice, webserviceurl } from '../ipc.js';

const debug = createDebug('app:preload-webservice:quirks:nooklink');

//
// NookLink must start at the main page, otherwise it will fail to load.
// This is required so refreshing the page works.
//

const NOOKLINK_WEBSERVICE_ID = 4953919198265344;

if (webservice.id === NOOKLINK_WEBSERVICE_ID) {
    const url = new URL(location.href);
    const initurl = new URL(webserviceurl);

    for (const key of [...url.searchParams.keys()]) {
        if (!initurl.searchParams.has(key)) {
            // Allow any extra query string parameters for deep links
            url.searchParams.delete(key);
        }
    }

    debug('URL', url, initurl);

    if (url.origin === initurl.origin && url.href !== initurl.href) {
        history.replaceState(null, document.title, initurl);
    }
}
