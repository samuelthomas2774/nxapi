import * as process from 'node:process';
import * as os from 'node:os';
import { git, release, version } from '../util/product.js';

const default_useragent = 'nxapi/' + version + ' (' +
    (!release && git ? 'git ' + git.revision.substr(0, 7) + (git.branch ? ' ' + git.branch : '') + '; ' : '') +
    'node ' + process.versions.node + '; ' +
    process.platform + ' ' + os.release() +
    ')';
const additional_useragents: string[] = [];

export function getAdditionalUserAgents() {
    return additional_useragents.join(' ');
}

export function addUserAgent(...useragent: string[]) {
    additional_useragents.push(...useragent);
}

let warned_no_useragent = false;

export function getUserAgent(additional = getAdditionalUserAgents()) {
    if (!additional && !warned_no_useragent) {
        console.warn(new Error('No User-Agent string was set'));
        warned_no_useragent = true;
    }

    return default_useragent + (additional ? ' ' + additional : '');
}
