import { join } from 'node:path';
import { init as initDebug } from './util/debug.js';
import { paths } from './util/product.js';

//
// cli entrypoint
//

if (process.env.NXAPI_DEBUG_FILE !== '0') {
    await initDebug(join(paths.log, 'cli'));
}

import('./cli.js').then(cli => cli.main.call(null));
