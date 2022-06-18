const electron = require('electron');

// Do anything that must be run before the app is ready...

electron.app.whenReady().then(() => import('./index.js')).then(m => m.init.call(null));
