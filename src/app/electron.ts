import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const electron = require('electron');

export default electron;
