import process from 'node:process';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import createDebug from 'debug';
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

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    await mkdirp(script_dir);

    const storage = await initStorage(argv.dataPath);
    await setup(argv);

    let {session, script} = await attach(argv);
    let ready: Promise<void> | null = null;

    let api: {
        ping(): Promise<true>;
        genAudioH(token: string, timestamp: string, uuid: string): Promise<string>;
        genAudioH2(token: string, timestamp: string, uuid: string): Promise<string>;
    } = script.exports as any;

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

        ready = attach(argv).then(a => {
            ready = null;
            session = a.session;
            script = a.script;
            api = script.exports as any;
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

        next();
    });

    app.post('/api/znca/f', bodyParser.json(), async (req, res) => {
        try {
            await ready;

            const data: {
                type: 'nso' | 'app';
                token: string;
                timestamp: string;
                uuid: string;
            } = req.body;

            if (
                typeof data !== 'object' ||
                (data.type !== 'nso' && data.type !== 'app') ||
                typeof data.token !== 'string' ||
                typeof data.timestamp !== 'string' ||
                typeof data.uuid !== 'string'
            ) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({error: 'invalid_request'}));
                return;
            }

            try {
                const [jwt, sig] = Jwt.decode<NintendoAccountIdTokenJwtPayload | CoralJwtPayload>(data.token);

                const check_signature = jwt.payload.iss === 'https://accounts.nintendo.com';

                if (data.type === 'nso' && jwt.payload.iss !== 'https://accounts.nintendo.com') {
                    throw new Error('Invalid token issuer');
                }
                if (data.type === 'nso' && jwt.payload.aud !== ZNCA_CLIENT_ID) {
                    throw new Error('Invalid token audience');
                }
                if (data.type === 'app' && jwt.payload.iss !== 'api-lp1.znc.srv.nintendo.net') {
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

            debugApi('Calling %s', data.type === 'app' ? 'genAudioH2' : 'genAudioH');

            const result = data.type === 'app' ?
                await api.genAudioH2(data.token, data.timestamp, data.uuid) :
                await api.genAudioH(data.token, data.timestamp, data.uuid);

            debugApi('Returned %s', result);

            const response = {
                f: result,
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
}

const frida_script = `
rpc.exports = {
    ping() {
        return true;
    },
    genAudioH(token, timestamp, uuid) {
        return new Promise(resolve => {
            Java.perform(() => {
                const libvoip = Java.use('com.nintendo.coral.core.services.voip.LibvoipJni');

                resolve(libvoip.genAudioH(token, timestamp, uuid));
            });
        });
    },
    genAudioH2(token, timestamp, uuid) {
        return new Promise(resolve => {
            Java.perform(() => {
                const libvoip = Java.use('com.nintendo.coral.core.services.voip.LibvoipJni');

                resolve(libvoip.genAudioH2(token, timestamp, uuid));
            });
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
