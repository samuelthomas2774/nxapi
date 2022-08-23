import process from 'node:process';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import createDebug from 'debug';
import { v4 as uuidgen } from 'uuid';
import express from 'express';
import bodyParser from 'body-parser';
import mkdirp from 'mkdirp';
import type { Arguments as ParentArguments } from '../cli.js';
import { NintendoAccountIdTokenJwtPayload } from '../api/na.js';
import { CoralJwtPayload, ZNCA_CLIENT_ID } from '../api/coral.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util/yargs.js';
import { initStorage, paths } from '../util/storage.js';
import { getJwks, Jwt } from '../util/jwt.js';
import { product } from '../util/product.js';
import { parseListenAddress } from '../util/net.js';

const debug = createDebug('cli:android-znca-api-server-frida');
const debugApi = createDebug('cli:android-znca-api-server-frida:api');

const script_dir = path.join(paths.temp, 'android-znca-api-server');

export const command = 'android-znca-api-server-frida <device>';
export const desc = 'Connect to a rooted Android device with frida-server over ADB running the Nintendo Switch Online app and start a HTTP server to generate f parameters';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('device', {
        describe: 'ADB server address/port',
        type: 'string',
        demandOption: true,
    }).option('exec-command', {
        describe: 'Command to use to run a file on the device',
        type: 'string',
    }).option('frida-server-path', {
        describe: 'Path to the frida-server executable on the device',
        type: 'string',
        default: '/data/local/tmp/frida-server',
    }).option('validate-tokens', {
        describe: 'Validate tokens before passing them to znca',
        type: 'boolean',
        default: true,
    }).option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

interface PackageInfo {
    name: string;
    version: string;
    build: number;
}
interface SystemInfo {
    board: string;
    bootloader: string;
    brand: string;
    abis: string[];
    device: string;
    display: string;
    fingerprint: string;
    hardware: string;
    host: string;
    id: string;
    manufacturer: string;
    model: string;
    product: string;
    tags: string;
    time: string;
    type: string;
    user: string;

    version: {
        codename: string;
        release: string;
        // release_display: string;
        sdk: string;
        sdk_int: number;
        security_patch: string;
    };
}

interface FResult {
    f: string;
    timestamp: string;
}

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    await mkdirp(script_dir);

    const storage = await initStorage(argv.dataPath);
    await setup(argv);

    let {session, script} = await attach(argv);
    let ready: Promise<void> | null = null;

    let api: {
        ping(): Promise<true>;
        getPackageInfo(): Promise<PackageInfo>;
        getSystemInfo(): Promise<SystemInfo>;
        genAudioH(token: string, timestamp: string | number | undefined, request_id: string): Promise<FResult>;
        genAudioH2(token: string, timestamp: string | number | undefined, request_id: string): Promise<FResult>;
    } = script.exports as any;

    let system_info = await api.getSystemInfo();
    let package_info = await api.getPackageInfo();

    const onexit = (code: number | NodeJS.Signals) => {
        // @ts-expect-error
        process.removeListener('exit', onexit);
        // @ts-expect-error
        process.removeListener('SIGTERM', onexit);
        // @ts-expect-error
        process.removeListener('SIGINT', onexit);

        debug('Exiting', code);
        debug('Releasing wake lock', argv.device);
        execScript(argv.device, '/data/local/tmp/android-znca-api-server-shutdown.sh', argv.execCommand);
        process.exit(typeof code === 'number' ? code : 0);
    };

    process.on('exit', onexit);
    process.on('SIGTERM', onexit);
    process.on('SIGINT', onexit);

    function reattach() {
        // Already attempting to reattach
        if (ready) return;

        debug('Attempting to reconnect to the device');

        ready = attach(argv).then(async a => {
            ready = null;
            session = a.session;
            script = a.script;
            api = script.exports as any;

            const new_system_info = await api.getSystemInfo();
            const new_package_info = await api.getPackageInfo();

            if (system_info.version.sdk_int !== new_system_info.version.sdk_int) {
                debug('Android system version updated while disconnected');
            }
            if (package_info.build !== new_package_info.build) {
                debug('znca version updated while disconnected');
            }

            system_info = new_system_info;
            package_info = new_package_info;
        }).catch(err => {
            console.error('Reattach failed', err);
            process.exit(1);
        });
    }

    const app = express();

    app.use('/api/znca', (req, res, next) => {
        console.log('[%s] %s %s HTTP/%s from %s, port %d%s, %s',
            new Date(), req.method, req.path, req.httpVersion,
            req.socket.remoteAddress, req.socket.remotePort,
            req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
            req.headers['user-agent']);

        res.setHeader('Server', product + ' android-znca-api-frida');
        res.setHeader('X-Android-Build-Type', system_info.type);
        res.setHeader('X-Android-Release', system_info.version.release);
        res.setHeader('X-Android-Platform-Version', system_info.version.sdk_int);
        res.setHeader('X-znca-Platform', 'Android');
        res.setHeader('X-znca-Version', package_info.version);
        res.setHeader('X-znca-Build', package_info.build);

        next();
    });

    app.post('/api/znca/f', bodyParser.json(), async (req, res) => {
        try {
            await ready;

            let data: {
                hash_method: '1' | '2';
                token: string;
                timestamp?: string | number;
                request_id?: string;
            } | {
                type: 'nso' | 'app';
                token: string;
                timestamp?: string;
                uuid?: string;
            } = req.body;

            if (data && 'type' in data) data = {
                hash_method:
                    data.type === 'nso' ? '1' :
                    data.type === 'app' ? '2' : null!,
                token: data.token,
                timestamp: '' + data.timestamp,
                request_id: data.uuid,
            };

            if (
                !data ||
                typeof data !== 'object' ||
                (data.hash_method !== '1' && data.hash_method !== '2') ||
                typeof data.token !== 'string' ||
                (data.timestamp && typeof data.timestamp !== 'string' && typeof data.timestamp !== 'number') ||
                (data.request_id && typeof data.request_id !== 'string')
            ) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({error: 'invalid_request'}));
                return;
            }

            try {
                const [jwt, sig] = Jwt.decode<NintendoAccountIdTokenJwtPayload | CoralJwtPayload>(data.token);

                const check_signature = jwt.payload.iss === 'https://accounts.nintendo.com';

                if (data.hash_method === '1' && jwt.payload.iss !== 'https://accounts.nintendo.com') {
                    throw new Error('Invalid token issuer');
                }
                if (data.hash_method === '1' && jwt.payload.aud !== ZNCA_CLIENT_ID) {
                    throw new Error('Invalid token audience');
                }
                if (data.hash_method === '2' && jwt.payload.iss !== 'api-lp1.znc.srv.nintendo.net') {
                    throw new Error('Invalid token issuer');
                }

                if (jwt.payload.exp <= (Date.now() / 1000)) {
                    throw new Error('Token expired');
                }

                const jwks = jwt.header.kid &&
                    jwt.header.jku?.match(/^https\:\/\/([^/]+\.)?nintendo\.(com|net)(\/|$)/i) ?
                    await getJwks(jwt.header.jku, storage) : null;

                if (check_signature && !jwks) {
                    throw new Error('Requires signature verification, but trusted JWKS URL and key ID not included in token');
                }

                const jwk = jwks?.keys.find(jwk => jwk.use === 'sig' && jwk.alg === jwt.header.alg &&
                    jwk.kid === jwt.header.kid && jwk.x5c?.length);
                const cert = jwk?.x5c?.[0] ? '-----BEGIN CERTIFICATE-----\n' +
                    jwk.x5c[0].match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----\n' : null;

                if (!cert) {
                    if (check_signature) throw new Error('Not verifying signature, no JKW found for this token');
                    else debug('Not verifying signature, no JKW found for this token');
                }

                const signature_valid = cert && jwt.verify(sig, cert);

                if (check_signature && !signature_valid) {
                    throw new Error('Invalid signature');
                }

                if (!check_signature) {
                    if (signature_valid) debug('JWT signature is valid');
                    else debug('JWT signature is not valid or not checked');
                }
            } catch (err) {
                if (argv.validateTokens) {
                    debug('Error validating token from %s', req.ip, err);
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({error: 'invalid_token', error_message: (err as Error).message}));
                    return;
                } else {
                    debug('Error validating token from %s, continuing anyway', req.ip, err);
                }
            }

            const timestamp = data.timestamp ? '' + data.timestamp : undefined;
            const request_id = data.request_id ? data.request_id : uuidgen();

            debugApi('Calling %s', data.hash_method === '2' ? 'genAudioH2' : 'genAudioH');

            const result = data.hash_method === '2' ?
                await api.genAudioH2(data.token, timestamp, request_id) :
                await api.genAudioH(data.token, timestamp, request_id);

            debugApi('Returned %s', result);

            const response = {
                f: result.f,
                timestamp: data.timestamp ? undefined : result.timestamp,
                request_id: data.request_id ? undefined : request_id,
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
        } catch (err) {
            debugApi('Error in request from %s', req.ip, err);

            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({error: 'unknown'}));

            if ((err as any)?.message === 'Script is destroyed') {
                reattach();
            }
        }
    });

    for (const address of argv.listen) {
        const [host, port] = parseListenAddress(address);
        const server = app.listen(port, host ?? '::');
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log('Listening on %s, port %d', address.address, address.port);
        });
    }

    setInterval(async () => {
        try {
            await api.ping();
        } catch (err) {
            if ((err as any)?.message === 'Script is destroyed') {
                reattach();
                return;
            }

            throw err;
        }
    }, 5000);

    debug('System info', system_info);
    debug('Package info', package_info);

    try {
        debug('Test gen_audio_h');
        const result = await api.genAudioH('id_token', 'timestamp', 'request_id');
        debug('Test returned', result);
    } catch (err) {
        debug('Test failed', err);
    }
}

const frida_script = `
const perform = callback => new Promise((rs, rj) => {
    Java.scheduleOnMainThread(() => {
        try {
            rs(callback());
        } catch (err) {
            rj(err);
        }
    });
});

rpc.exports = {
    ping() {
        return true;
    },
    getPackageInfo() {
        return perform(() => {
            const context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();

            const info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);

            return {
                name: info.packageName.value,
                version: info.versionName.value,
                build: info.versionCode.value,
                // build: info.getLongVersionCode(),
            };
        });
    },
    getSystemInfo() {
        return perform(() => {
            const Build = Java.use('android.os.Build');
            const Version = Java.use('android.os.Build$VERSION');

            return {
                board: Build.BOARD.value,
                bootloader: Build.BOOTLOADER.value,
                brand: Build.BRAND.value,
                abis: Build.SUPPORTED_ABIS.value,
                device: Build.DEVICE.value,
                display: Build.DISPLAY.value,
                fingerprint: Build.FINGERPRINT.value,
                hardware: Build.HARDWARE.value,
                host: Build.HOST.value,
                id: Build.ID.value,
                manufacturer: Build.MANUFACTURER.value,
                model: Build.MODEL.value,
                product: Build.PRODUCT.value,
                tags: Build.TAGS.value,
                time: Build.TIME.value,
                type: Build.TYPE.value,
                user: Build.USER.value,

                version: {
                    codename: Version.CODENAME.value,
                    release: Version.RELEASE.value,
                    sdk: Version.SDK.value,
                    sdk_int: Version.SDK_INT.value,
                    security_patch: Version.SECURITY_PATCH.value,
                },
            };
        });
    },
    genAudioH(token, timestamp, request_id) {
        return perform(() => {
            const libvoip = Java.use('com.nintendo.coral.core.services.voip.LibvoipJni');
            const context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
            libvoip.init(context);

            if (!timestamp) timestamp = Date.now();

            return {
                f: libvoip.genAudioH(token, '' + timestamp, request_id),
                timestamp,
            };
        });
    },
    genAudioH2(token, timestamp, request_id) {
        return perform(() => {
            const libvoip = Java.use('com.nintendo.coral.core.services.voip.LibvoipJni');
            const context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
            libvoip.init(context);

            if (!timestamp) timestamp = Date.now();

            return {
                f: libvoip.genAudioH2(token, '' + timestamp, request_id),
                timestamp,
            };
        });
    },
};
`;

const setup_script = (options: {
    frida_server_path: string;
}) => `#!/system/bin/sh

# Ensure frida-server is running
echo "Running frida-server"
killall ${JSON.stringify(path.basename(options.frida_server_path))}
nohup ${JSON.stringify(options.frida_server_path)} >/dev/null 2>&1 &

if [ "$?" != "0" ]; then
    echo "Failed to start frida-server"
    exit 1
fi

sleep 1

# Ensure the app is running
echo "Starting com.nintendo.znca"
am start-foreground-service com.nintendo.znca/com.google.firebase.messaging.FirebaseMessagingService
am start-service com.nintendo.znca/com.google.firebase.messaging.FirebaseMessagingService

if [ "$?" != "0" ]; then
    echo "Failed to start com.nintendo.znca"
    exit 1
fi

echo "Acquiring wake lock"
echo androidzncaapiserver > /sys/power/wake_lock
`;

const shutdown_script = `#!/system/bin/sh

echo "Releasing wake lock"
echo androidzncaapiserver > /sys/power/wake_unlock
`;

async function setup(argv: ArgumentsCamelCase<Arguments>) {
    debug('Connecting to device %s', argv.device);
    let co = execFileSync('adb', [
        'connect',
        argv.device,
    ]);

    while (co.toString().includes('failed to authenticate')) {
        console.log('');
        console.log('-- Allow this computer to connect to the device. --');
        console.log('');
        await new Promise(rs => setTimeout(rs, 5 * 1000));

        execAdb([
            'disconnect',
            argv.device,
        ]);

        debug('Connecting to device %s', argv.device);
        co = execFileSync('adb', [
            'connect',
            argv.device,
        ]);
    }

    debug('Pushing scripts');

    await pushScript(argv.device, setup_script({
        frida_server_path: argv.fridaServerPath,
    }), '/data/local/tmp/android-znca-api-server-setup.sh');
    await pushScript(argv.device, shutdown_script, '/data/local/tmp/android-znca-api-server-shutdown.sh');
}

async function attach(argv: ArgumentsCamelCase<Arguments>) {
    const frida = await import('frida');
    type Session = import('frida').Session;

    debug('Running scripts');
    execScript(argv.device, '/data/local/tmp/android-znca-api-server-setup.sh', argv.execCommand);

    debug('Done');

    const device = await frida.getDevice(argv.device);
    debug('Connected to frida device %s', device.name);

    let session: Session;

    try {
        const process = await device.getProcess('Nintendo Switch Online');

        debug('process', process);

        session = await device.attach(process.pid);
    } catch (err) {
        debug('Could not attach to process', err);
        throw new Error('Failed to attach to process');
    }

    debug('Attached to app process, pid %d', session.pid);

    const script = await session.createScript(frida_script);
    await script.load();

    return {session, script};
}

function execAdb(args: string[], device?: string) {
    execFileSync('adb', device ? ['-s', device, ...args] : args, {
        stdio: 'inherit',
    });
}

async function getScriptPath(content: string) {
    const filename = path.join(script_dir, crypto.createHash('sha256').update(content).digest('hex') + '.sh');

    await fs.writeFile(filename, content);
    await fs.chmod(filename, 0o755);

    return filename;
}

async function pushScript(device: string, content: string, path: string) {
    const filename = await getScriptPath(content);

    debug('Pushing script', path, filename);

    execAdb([
        'push',
        filename,
        path,
    ], device);

    execAdb([
        'shell',
        'chmod 755 ' + JSON.stringify(path),
    ], device);
}

function execScript(device: string, path: string, exec_command?: string) {
    const command = exec_command ?
        exec_command.replace('{cmd}', JSON.stringify(path)) :
        path;

    debug('Running script', command);

    execAdb([
        'shell',
        command,
    ], device);
}
