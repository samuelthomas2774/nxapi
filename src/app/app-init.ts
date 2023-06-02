import { join } from 'node:path';
import { init as initDebug } from '../util/debug.js';
import { paths } from '../util/product.js';

await initDebug(join(paths.log, 'app'));
