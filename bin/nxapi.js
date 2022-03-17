#!/usr/bin/env node

import('../dist/cli.js').then(cli => cli.default.argv);
