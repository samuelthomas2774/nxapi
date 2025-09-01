import * as fs from 'node:fs/promises';
import * as child_process from 'node:child_process';
import * as util from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = util.promisify(child_process.execFile);
const options = {cwd: fileURLToPath(new URL('../..', import.meta.url))};
const git = (...args) => execFile('git', args, options).then(({stdout}) => stdout.toString().trim());

const pkg = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url), 'utf-8'));

const [revision, branch, changed_files] = await Promise.all([
    process.env.CI_COMMIT_SHA || git('rev-parse', 'HEAD'),
    process.env.CI_COMMIT_BRANCH || git('rev-parse', '--abbrev-ref', 'HEAD'),
    git('diff', '--name-only', 'HEAD'),
]);

if (process.argv[2] === 'gitlab') {
    pkg.name = process.env.GITLAB_NPM_PACKAGE_NAME ?? pkg.name;
    pkg.publishConfig = {access: 'public'};
}

if (process.argv[2] === 'github') {
    pkg.name = process.env.GITHUB_NPM_PACKAGE_NAME ?? pkg.name;
    pkg.repository = {
        type: 'git',
        url: 'https://github.com/' + process.env.GITHUB_REPOSITORY + '.git',
    };
    pkg.publishConfig = {access: 'public'};
}

pkg.version = process.env.VERSION || pkg.version;
pkg.__nxapi_release = process.env.CI_COMMIT_TAG;

if (process.argv[2] === 'docker') {
    pkg.__nxapi_docker = process.argv[3];
}

pkg.__nxapi_git = pkg.__nxapi_git ?? {
    revision,
    branch: branch && branch !== 'HEAD' ? branch : null,
    changed_files: changed_files.length ? changed_files.split('\n') : [],
};

pkg.__nxapi_auth = process.env.NXAPI_AUTH_CLI_CLIENT_ID || process.env.NXAPI_AUTH_APP_CLIENT_ID ? {
    cli: process.env.NXAPI_AUTH_CLI_CLIENT_ID ? {
        client_id: process.env.NXAPI_AUTH_CLI_CLIENT_ID,
    } : undefined,
    app: process.env.NXAPI_AUTH_APP_CLIENT_ID ? {
        client_id: process.env.NXAPI_AUTH_APP_CLIENT_ID,
    } : undefined,
} : undefined;

await fs.writeFile(new URL('../../package.json', import.meta.url), JSON.stringify(pkg, null, 4) + '\n', 'utf-8');
