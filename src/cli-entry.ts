import createDebug from 'debug';

//
// cli entrypoint for Rollup bundle
//

createDebug.log = console.warn.bind(console);

import('./cli.js').then(cli => cli.main.call(null));
