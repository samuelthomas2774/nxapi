import createDebug from 'debug';

// Logs are written to the browser window developer tools, and are hidden by default (enable verbose logs)
const debug = createDebug('app:preload-webservice');

import './znca-js-api.js';
import './quirks/nooklink.js';
