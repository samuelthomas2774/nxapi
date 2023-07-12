import process from 'node:process';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';
import { fetch } from 'undici';
import DiscordRPC from 'discord-rpc';
// @ts-expect-error
import __BaseIpcTransport from 'discord-rpc/src/transports/ipc.js';
import createDebug from '../util/debug.js';

const debug = createDebug('nxapi:discord:rpc');

declare class _BaseIpcTransport extends EventEmitter {
    constructor(client: DiscordRPC.Client);
    connect(): Promise<void>;
    onClose(e: boolean): void;
    send(data: unknown, op?: OPCode): void;
    close(): Promise<boolean>;
    ping(): void;
    static encode(op: OPCode, data: unknown): Buffer;
    static decode(socket: net.Socket, callback: (op: OPCode, data: unknown) => void): void;
}

const BaseIpcTransport = __BaseIpcTransport as typeof _BaseIpcTransport;

export async function getDiscordRpcClients() {
    const sockets = await getAllIpcSockets();

    return sockets.map(s => new DiscordRpcClient({transport: 'ipc', ipc_socket: s[1]}));
}

export async function findDiscordRpcClient(
    clientid: string, filter: (client: DiscordRpcClient, id: number) => boolean
) {
    for (let i = 0; i < 10; i++) {
        const socket = await getIpcSocket(i);
        if (!socket) continue;

        const client = new DiscordRpcClient({transport: 'ipc', ipc_socket: socket});
        await client.connect(clientid);

        try {
            if (filter.call(null, client, i)) return [i, client] as const;

            await client.destroy();
        } catch (err) {
            await client.destroy();
            throw err;
        }
    }

    throw new Error('Failed to find a matching Discord client');
}

//
// Patches discord-rpc to allow using a specific socket.
//

export class DiscordRpcClient extends DiscordRPC.Client {
    constructor(options?: DiscordRPC.RPCClientOptions & {
        ipc_socket?: net.Socket;
    }) {
        super({
            transport: 'ipc',
            ...options,
        });

        if (options?.transport ?? 'ipc' === 'ipc') {
            // @ts-expect-error
            this.transport = new IpcTransport(this);
            // @ts-expect-error
            if (options?.ipc_socket) this.transport.socket = options?.ipc_socket;
            // @ts-expect-error
            this.transport.on('message', this._onRpcMessage.bind(this));
        }
    }
}

class IpcTransport extends BaseIpcTransport {
    client!: DiscordRpcClient;
    socket!: net.Socket | null;

    onClose!: () => void;

    async connect() {
        const socket = this.socket = this.socket ?? await getIpc();
        socket.on('close', this.onClose.bind(this));
        socket.on('error', this.onClose.bind(this));
        this.emit('open');
        socket.write(BaseIpcTransport.encode(OPCode.HANDSHAKE, {
            v: 1,
            // @ts-expect-error
            client_id: this.client.clientId,
        }));
        socket.pause();
        socket.on('readable', () => {
            // @ts-expect-error
            BaseIpcTransport.decode(socket, ({ op, data }) => {
                switch (op) {
                    case OPCode.PING:
                        this.send(data, OPCode.PONG);
                        break;
                    case OPCode.FRAME:
                        if (!data) {
                            return;
                        }
                        if (data.cmd === 'AUTHORIZE' && data.evt !== 'ERROR') {
                            findEndpoint().then(endpoint => {
                                // @ts-expect-error
                                this.client.request.endpoint = endpoint;
                            }).catch(e => this.client.emit('error', e));
                        }
                        // a@ts-expect-error
                        this.emit('message', data);
                        break;
                    case OPCode.CLOSE:
                        // a@ts-expect-error
                        this.emit('close', data);
                        break;
                    default:
                        break;
                }
            });
        });
    }
}

enum OPCode {
    HANDSHAKE = 0,
    FRAME = 1,
    CLOSE = 2,
    PING = 3,
    PONG = 4,
}

function getIpcPath(id: number) {
    if (process.platform === 'win32') {
        return `\\\\?\\pipe\\discord-ipc-${id}`;
    }
    const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
}

export function getIpc(id = 0) {
    return new Promise<net.Socket>((resolve, reject) => {
        const path = getIpcPath(id);
        const onerror = () => {
            if (id < 10) {
                resolve(getIpc(id + 1));
            } else {
                reject(new Error('Could not connect'));
            }
        };
        const sock = net.createConnection(path, () => {
            sock.removeListener('error', onerror);
            resolve(sock);
        });
        sock.once('error', onerror);
    });
}

export function getIpcSocket(id: number) {
    return new Promise<net.Socket | null>((resolve, reject) => {
        const path = getIpcPath(id);
        const onerror = () => resolve(null);
        const sock = net.createConnection(path, () => {
            sock.removeListener('error', onerror);
            resolve(sock);
        });
        sock.once('error', onerror);
    });
}

export function getAllIpcSockets() {
    const promises: Promise<[number, net.Socket | null]>[] = [];

    for (let i = 0; i < 10; i++) {
        promises.push(getIpcSocket(i).then(s => [i, s]));
    }

    return Promise.all(promises).then(s => s.filter(s => s[1]) as [number, net.Socket][]);
}

async function findEndpoint(tries = 0): Promise<string> {
    if (tries > 30) {
        throw new Error('Could not find endpoint');
    }
    const endpoint = `http://127.0.0.1:${6463 + (tries % 10)}`;
    try {
        const r = await fetch(endpoint);
        if (r.status === 404) {
            return endpoint;
        }
        return findEndpoint(tries + 1);
    } catch (e) {
        return findEndpoint(tries + 1);
    }
}
