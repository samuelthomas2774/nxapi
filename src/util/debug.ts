import { WriteStream } from 'node:fs';
import { FileHandle, mkdir, open, opendir, stat, unlink } from 'node:fs/promises';
import * as util from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createDebug from 'debug';
import { dev, dir, docker, git, product, release, version } from './product.js';

const MAX_FILE_SIZE = 1000 * 1000 * 2; // 2 MB
const DELETE_AFTER_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

createDebug.log = console.warn.bind(console);

export default new Proxy(createDebug, {
    apply(target, thisArg, args: [string]) {
        const debug = target.apply(thisArg, args);

        return new Proxy(debug, handler);
    },
});

const handler: ProxyHandler<createDebug.Debugger> = {
    apply(target, thisArg, args: [formatter: any, ...args: any[]]) {
        if (log_file) {
            args[0] = createDebug.coerce(args[0]);

            if (typeof args[0] !== 'string') {
                // Anything else let's inspect with %O
                args.unshift('%O');
            }

            // Apply any `formatters` transformations
            applyFormatters(args, target);

            writeToFile(target.namespace, args);

            args[0] = args[0].replace(/%/g, '%%');
        }

        return target.apply(thisArg, args);
    },
};

const debug = new Proxy(createDebug('nxapi:util:debug'), handler);
debug.enabled = true;

function applyFormatters(args: [formatter: string, ...args: unknown[]], self = debug) {
    // https://github.com/debug-js/debug/blob/d1616622e4d404863c5a98443f755b4006e971dc/src/common.js#L89-L107

    let index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
        // If we encounter an escaped % then don't increase the array index
        if (match === '%%') {
            return '%';
        }
        index++;
        const formatter = createDebug.formatters[format];
        if (typeof formatter === 'function') {
            const val = args[index];
            match = formatter.call(self, val);

            // Now we need to remove `args[index]` since it's inlined in the `format`
            args.splice(index, 1);
            index--;
        }
        return match;
    });
    return args;
}

const censor_fields = [
    'token',
    // OAuth/OIDC
    'access_token', 'id_token', 'refresh_token', 'client_secret',
    // Coral
    'accessToken', 'supportId', 'naIdToken',
    // Moon
    'serialNumber', 'notificationToken',
];
const censor_regexp = new RegExp('^(\\s*(' + censor_fields.join('|') + '): \')(([^\']{10})[^\']{20,}([^\']{10})|[^\']{1,39})(\'( \})*,?)$', 'gm');

function writeToFile(namespace: string, _args: [formatter: string, ...args: unknown[]], skip_new = false) {
    if (!log_file) return;

    const [formatter, ...args] = _args;

    const data = (new Date()).toISOString() + ' ' + namespace + ' ' +
	    util.format(formatter, ...args)
            .replace(/\u001B\[[0-9;]*m/g, '')
            .replace(censor_regexp, '$1$4••••••••$5$6') + '\n';
    const buffer = (new TextEncoder()).encode(data);

    const [, stream, path, start, i] = log_file;

    stream.write(buffer);
    log_file[5] += buffer.length;

    if (!skip_new && log_file[5] !== buffer.length && log_file[5] >= MAX_FILE_SIZE && !log_file[6]) {
        log_file[6] = openLogFile(path, start, i + 1).catch(err => {
            if (log_file) log_file[6] = null;

            debug('Error opening next log file', path, start, i + 1, err);
        });
    }
}

let log_file: [
    handle: FileHandle, stream: WriteStream,
    path: string, start: Date, i: number, bytes: number, replace: Promise<void> | null,
] | null = null;

export async function init(path: string | URL, ignore_errors = true) {
    if (log_file) throw new Error('Already initialised log file');

    if (path instanceof URL) path = fileURLToPath(path);

    const start = new Date();

    try {
        await openLogFile(path, start);
    } catch (err) {
        if (!ignore_errors) throw err;

        debug('Error opening log file', path);
    }

    deleteOldLogs(path).catch(err => {
        debug('Error deleting old logs', path, err);
    });
}

async function openLogFile(path: string, start: Date, i = 0) {
    const filename =
        start.toISOString().replace(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)\..*/, '$1$2$3-$4$5') +
        '-' + process.pid + '-' + i + '.log';
    const file = join(path, filename);

    await mkdir(path, {mode: 0o700, recursive: true});

    const file_handle = await open(file, 'a', 0o600);
    const stream = file_handle.createWriteStream();

    if (log_file) {
        const [prev_handle, prev_stream] = log_file;
        prev_stream.close();
        prev_handle.close();
    }

    log_file = [file_handle, stream, path, start, i, 0, null];

    debug('start log file %s', file);

    if (i === 0) {
        writeToFile('nxapi:util:debug', applyFormatters(['product %O, versions %O', {
            dir, version, release, docker, git, dev, product,
        }, process.versions]), true);
        writeToFile('nxapi:util:debug', applyFormatters(['argv %O', process.argv]), true);
        writeToFile('nxapi:util:debug', applyFormatters(['env %O', process.env]), true);
    }
}

async function deleteOldLogs(path: string) {
    // Files that will be excluded by recently_accessed may not be included
    const log_files: [id: string, name: string][] = [];
    const recently_accessed: string[] = [];

    for await (const dirent of await opendir(path)) {
        if (!dirent.isFile()) continue;

        const match = dirent.name.match(/^(((\d+)-(\d+))-(\d+))(-(\d+))?\.log$/);
        if (!match) continue;

        const [, id, datetime, date, time, pid, i] = match;
        if (recently_accessed.includes(id)) continue;

        const stats = await stat(join(path, dirent.name));

        if ((stats.mtimeMs + DELETE_AFTER_MS) >= Date.now()) {
            recently_accessed.push(id);
            continue;
        }

        log_files.push([id, dirent.name]);
    }

    const to_delete = log_files.filter(([id, name]) => !recently_accessed.includes(id));

    for (const [id, name] of to_delete) {
        const file = join(path, name);
        debug('delete old log file', file);
        await unlink(file);
    }
}
