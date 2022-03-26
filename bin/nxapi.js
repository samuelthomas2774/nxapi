#!/usr/bin/env node

import createDebug from 'debug';

createDebug.log = console.warn.bind(console);

import('../dist/cli.js').then(cli => cli.default.argv);
