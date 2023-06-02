import * as process from 'node:process';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
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

export function addUserAgentFromPackageJson(pkg: string | URL, additional?: string): Promise<void>;
export function addUserAgentFromPackageJson(pkg: object, additional?: string): void;
export function addUserAgentFromPackageJson(pkg: string | URL | object, additional?: string) {
    if (typeof pkg === 'string' || pkg instanceof URL) {
        return fs.readFile(pkg, 'utf-8').then(pkg => addUserAgentFromPackageJson(JSON.parse(pkg)));
    }

    const name = 'name' in pkg && typeof pkg.name === 'string' ? pkg.name : null;
    const version = 'version' in pkg && typeof pkg.version === 'string' ? pkg.version : null;
    if (!name || !version) throw new Error('package.json does not contain valid name and version fields');

    const homepage = 'homepage' in pkg ? pkg.homepage : null;
    if (homepage != null && typeof homepage !== 'string') throw new Error('package.json contains an invalid homepage field');
    const repository = 'repository' in pkg && pkg.repository != null ?
        getPackageJsonRepository(pkg.repository) : null;

    const end =
        (homepage ? '+' + homepage : repository ? '+' + repository.url : '') +
        (repository && additional ? '; ' : '') +
        additional;

    const useragent = name + '/' + version + (end ? ' (' + end + ')' : '');

    addUserAgent(useragent);
}

function getPackageJsonRepository(repository: unknown): {
    type: string; url: string; directory?: string | null;
} {
    if (typeof repository === 'string') {
        if (repository.startsWith('github:')) {
            return {type: 'git', url: 'https://github.com/' + repository.substr(7)};
        }
        if (repository.startsWith('gist:')) {
            return {type: 'git', url: 'https://gist.github.com/' + repository.substr(5)};
        }
        if (repository.startsWith('bitbucket:')) {
            return {type: 'git', url: 'https://bitbucket.org/' + repository.substr(10)};
        }
        if (repository.startsWith('gitlab:')) {
            return {type: 'git', url: 'https://gitlab.com/' + repository.substr(7)};
        }
        if (repository.match(/^[0-9a-z-.]+\/[0-9a-z-.]+$/i)) {
            return {type: 'git', url: 'https://github.com/' + repository};
        }
    }

    if (typeof repository === 'object' && repository) {
        if ('type' in repository && typeof repository.type === 'string' &&
            'url' in repository && typeof repository.url === 'string' &&
            (!('directory' in repository) || repository.directory == null || typeof repository.directory === 'string')
        ) {
            return {
                type: repository.type, url: repository.url,
                directory: 'directory' in repository ? repository.directory as string : null,
            };
        }
    }

    throw new Error('package.json contains an invalid repository field');
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
