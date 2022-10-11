import * as fs from 'node:fs/promises';
import * as child_process from 'node:child_process';
import * as util from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = util.promisify(child_process.execFile);

const options = {cwd: fileURLToPath(new URL('../..', import.meta.url))};
const git = (...args) => execFile('git', args, options).then(({stdout}) => stdout.toString().trim());

const pkg = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url), 'utf-8'));

const [revision, branch_str, changed_files_str, tags_str, commit_count_str] = await Promise.all([
    git('rev-parse', 'HEAD'),
    git('rev-parse', '--abbrev-ref', 'HEAD'),
    git('diff', '--name-only', 'HEAD'),
    git('log', '--tags', '--no-walk', '--pretty=%D'),
    git('rev-list', '--count', 'HEAD'),
]);

const branch = branch_str && branch_str !== 'HEAD' ? branch_str : null;
const changed_files = changed_files_str.length ? changed_files_str.split('\n') : [];
const tags = tags_str.split('\n').filter(t => t.startsWith('tag: ')).map(t => t.substr(5));
const last_tagged_version = tags.find(t => t.startsWith('v'))?.substr(1) ?? null;
const last_version = last_tagged_version ?? pkg.version;
const commit_count = parseInt(commit_count_str);

console.warn({
    version: pkg.version,
    last_tagged_version,
    last_version,
    revision,
    branch,
    changed_files,
    tags,
    tags_str,
    commit_count,
});

if (!last_tagged_version || pkg.version !== last_tagged_version) {
    console.warn('Last tagged version does not match package.json version', {
        version: pkg.version,
        tag: last_tagged_version ? 'v' + last_tagged_version : null,
    });
    process.exit();
}

const last_tagged_version_commit_count = parseInt(await git('rev-list', '--count', 'v' + last_version));
const commit_count_since_last_version = commit_count - last_tagged_version_commit_count;

console.warn({
    last_tagged_version_commit_count,
    commit_count_since_last_version,
});

if (commit_count_since_last_version <= 0) {
    console.warn('No changes since last tagged version');
    process.exit();
}

const version = last_version +
    '-next.' + (commit_count_since_last_version - 1) +
    '+sha.' + revision.substr(0, 7);

console.warn({
    version,
});

console.log(version);
