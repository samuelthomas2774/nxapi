import * as path from 'node:path';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import createDebug from '../util/debug.js';
import { paths } from '../util/storage.js';

let done = false;

export function init() {
    if (done) {
        throw new Error('Attempted to initialise global data twice');
    }

    done = true;

    dotenvExpand.expand(dotenv.config({
        path: path.join(paths.data, '.env'),
    }));
    if (process.env.NXAPI_DATA_PATH) dotenvExpand.expand(dotenv.config({
        path: path.join(process.env.NXAPI_DATA_PATH, '.env'),
    }));

    if (process.env.DEBUG) createDebug.enable(process.env.DEBUG);
}
