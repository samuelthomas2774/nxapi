import * as path from 'path';
import createDebug from 'debug';
import { execFileSync } from 'child_process';
import * as net from 'net';
import frida, { Session } from 'frida';
import express from 'express';
import bodyParser from 'body-parser';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../util.js';

const debug = createDebug('cli:android-znca-api-server-frida');
const debugApi = createDebug('cli:android-znca-api-server-frida:api');

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
    }).option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    await setup(argv);

    let {session, script} = await attach(argv);
    let ready: Promise<void> | null = null;

    let api: {
        ping(): Promise<true>;
        genAudioH(token: string, timestamp: string, uuid: string): Promise<string>;
        genAudioH2(token: string, timestamp: string, uuid: string): Promise<string>;
    } = script.exports as any;

    process.on('beforeExit', () => {
        debug('Releasing wake lock', argv.device);
        execFileSync('adb', [
            '-s',
            argv.device,
            'shell',
            'sh -c "echo androidzncaapiserver > /sys/power/wake_unlock"',
        ], {
            stdio: 'inherit',
        });
    });

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

    app.post('/api/znca/f', bodyParser.json(), async (req, res) => {
        try {
            console.log('Received request from %s, port %d', req.socket.remoteAddress, req.socket.remotePort);
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
        const match = address.match(/^(?:((?:\d+\.){3}\d+)|\[(.*)\]):(\d+)$/);
        if (!match || !net.isIP(match[1] || match[2])) throw new Error('Not a valid address/port');

        const server = app.listen(parseInt(match[3]), match[1] || match[2]);
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

        co = execFileSync('adb', [
            'disconnect',
            argv.device,
        ], {
            stdio: 'inherit',
        });

        debug('Connecting to device %s', argv.device);
        co = execFileSync('adb', [
            'connect',
            argv.device,
        ]);
    }

    debug('Pushing scripts');
    execFileSync('adb', [
        '-s',
        argv.device,
        'push',
        path.join(import.meta.url.substr(7), '..', '..', '..', 'resources', 'android-znca-api-server.sh'),
        '/data/local/tmp/android-znca-api-server.sh',
    ], {
        stdio: 'inherit',
    });

    execFileSync('adb', [
        '-s',
        argv.device,
        'shell',
        'chmod 755 /data/local/tmp/android-znca-api-server.sh',
    ], {
        stdio: 'inherit',
    });
}

async function attach(argv: ArgumentsCamelCase<Arguments>) {
    debug('Running scripts');
    execFileSync('adb', [
        '-s',
        argv.device,
        'shell',
        argv.execCommand ?
            argv.execCommand.replace('{cmd}', JSON.stringify('/data/local/tmp/android-znca-api-server.sh')) :
            '/data/local/tmp/android-znca-api-server.sh',
    ], {
        stdio: 'inherit',
    });

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
