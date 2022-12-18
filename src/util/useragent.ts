import * as process from 'node:process';
import * as os from 'node:os';
import { docker, git, release, version } from '../util/product.js';

const default_useragent = 'nxapi/' + version + ' (' +
    (!release && git ? 'git ' + git.revision.substr(0, 7) + (git.branch ? ' ' + git.branch : '') + '; ' :
        !release ? 'no-git; ' : '') +
    (typeof docker === 'string' ? 'docker ' + docker + '; ' : docker ? 'docker; ' : '') +
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

/**
 * Only used by cli/nso/http-server.ts.
 * This command is intended to be run automatically and doesn't make any requests itself, so this function removes
 * the unidentified-script user agent string.
 */
export function addCliFeatureUserAgent(...useragent: string[]) {
    if (additional_useragents[0] === 'nxapi-cli' && additional_useragents[1] === 'unidentified-script') {
        additional_useragents.splice(1, 1, ...useragent);
    } else if (additional_useragents[0] === 'nxapi-cli') {
        additional_useragents.splice(1, 0, ...useragent);
    } else {
        additional_useragents.splice(0, 0, ...useragent);
    }
}

let warned_no_useragent = false;

export function getUserAgent(additional = getAdditionalUserAgents()) {
    if (!additional && !warned_no_useragent) {
        console.warn(new Error('No User-Agent string was set'));
        warned_no_useragent = true;
    }

    return default_useragent + (additional ? ' ' + additional : '');
}
