const electron = require('electron');

// Do anything that must be run before the app is ready...

Promise.all([
    // @ts-expect-error
    typeof __NXAPI_BUNDLE_APP_INIT__ !== 'undefined' ? import(__NXAPI_BUNDLE_APP_INIT__) : import('./app-init.js'),
    electron.app.whenReady(),
])
    // @ts-expect-error
    .then(() => typeof __NXAPI_BUNDLE_APP_MAIN__ !== 'undefined' ? import(__NXAPI_BUNDLE_APP_MAIN__) : import('./main/index.js'))
    .then(m => m.init.call(null))
    .catch(err => {
        electron.dialog.showErrorBox('Error during startup', err?.stack ?? err?.message ?? err);
        process.exit(1);
    });
