// #!/usr/bin/env node

import createDebug from 'debug';

createDebug.log = console.warn.bind(console);

import('./cli.js').then(cli => cli.main.call(null));
