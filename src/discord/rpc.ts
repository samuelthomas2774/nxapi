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

        try {
            await client.connect(clientid);

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

export interface DiscordRpcClient {
    /**
     * Request
     * @param {string} cmd Command
     * @param {Object} [args={}] Arguments
     * @param {string} [evt] Event
     * @returns {Promise}
     * @private
     */
    request(cmd: string, args?: object, evt?: string): Promise<unknown>;
}

declare module 'discord-rpc' {
    interface Presence {
        name?: string;
        statusDisplayType?: DiscordApiActivityStatusDisplayType;
        stateUrl?: string;
        detailsUrl?: string;
        largeImageUrl?: string;
        smallImageUrl?: string;
    }
}

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

    setActivity(args: DiscordRPC.Presence, pid = process.pid) {
        const activity: DiscordRpcActivity = {
            name: args.name,
            type: DiscordApiActivityType.PLAYING,
            status_display_type: args.statusDisplayType,
            state: args.state,
            state_url: args.stateUrl,
            details: args.details,
            details_url: args.detailsUrl,
            buttons: args.buttons,
            instance: !!args.instance,
        };

        if (args.startTimestamp || args.endTimestamp) {
            activity.timestamps = {
                start: args.startTimestamp instanceof Date ? Math.round(args.startTimestamp.getTime()) : args.startTimestamp,
                end: args.endTimestamp instanceof Date ? Math.round(args.endTimestamp.getTime()) : args.endTimestamp,
            };
            if (typeof activity.timestamps.start === 'number' && activity.timestamps.start > 2147483647000) {
                throw new RangeError('timestamps.start must fit into a unix timestamp');
            }
            if (typeof activity.timestamps.end === 'number' && activity.timestamps.end > 2147483647000) {
                throw new RangeError('timestamps.end must fit into a unix timestamp');
            }
        }

        if (args.largeImageKey || args.largeImageText ||
            args.smallImageKey || args.smallImageText
        ) {
            activity.assets = {
                large_image: args.largeImageKey,
                large_text: args.largeImageText,
                large_url: args.largeImageUrl,
                small_image: args.smallImageKey,
                small_text: args.smallImageText,
                small_url: args.smallImageUrl,
            };
        }

        if (args.partySize || args.partyId || args.partyMax) {
            activity.party = {
                id: args.partyId,
                size: args.partySize || args.partyMax ? [args.partySize ?? 0, args.partyMax ?? 0] : undefined,
            };
        }

        if (args.matchSecret || args.joinSecret || args.spectateSecret) {
            activity.secrets = {
                match: args.matchSecret,
                join: args.joinSecret,
                spectate: args.spectateSecret,
            };
        }

        return this.setActivityRaw(activity, pid);
    }

    setActivityRaw(activity: DiscordRpcActivity, pid = process.pid) {
        debug('set activity', activity);

        return this.request('SET_ACTIVITY', {
            pid,
            activity,
        });
    }
}

type DiscordRpcActivity = Partial<Omit<DiscordApiActivity, 'created_at' | 'application_id' | 'emoji'>>;

interface DiscordApiActivity {
    name: string;
    type: DiscordApiActivityType;
    url?: string;
    created_at: number;
    timestamps?: DiscordApiActivityTimestamps;
    application_id?: string;
    status_display_type?: DiscordApiActivityStatusDisplayType;
    details?: string;
    details_url?: string;
    state?: string;
    state_url?: string;
    emoji?: DiscordApiActivityEmoji;
    party?: DiscordApiActivityParty;
    assets?: DiscordApiActivityAssets;
    secrets?: DiscordApiActivitySecrets;
    instance?: boolean;
    flags?: number;
    buttons?: DiscordApiActivityButton[];
}
enum DiscordApiActivityType {
    PLAYING = 0,
    STREAMING = 1,
    LISTENING = 2,
    WATCHING = 3,
    CUSTOM = 4,
    COMPETING = 5,
}
export enum DiscordApiActivityStatusDisplayType {
    NAME = 0,
    STATE = 1,
    DETAILS = 2,
}
interface DiscordApiActivityTimestamps {
    start?: number;
    end?: number;
}
interface DiscordApiActivityEmoji {
    name: string;
    id?: string;
    animated?: boolean;
}
interface DiscordApiActivityParty {
    id?: string;
    size?: [number, number];
}
interface DiscordApiActivityAssets {
    large_image?: string;
    large_text?: string;
    large_url?: string;
    small_image?: string;
    small_text?: string;
    small_url?: string;
}
interface DiscordApiActivitySecrets {
    join?: string;
    spectate?: string;
    match?: string;
}
enum DiscordApiActivityFlags {
    INSTANCE = 1 << 0,
    JOIN = 1 << 1,
    SPECTATE = 1 << 2,
    JOIN_REQUEST = 1 << 3,
    SYNC = 1 << 4,
    PLAY = 1 << 5,
    PARTY_PRIVACY_FRIENDS = 1 << 6,
    PARTY_PRIVACY_VOICE_CHANNEL = 1 << 7,
    EMBEDDED = 1 << 8,
}
interface DiscordApiActivityButton {
    label: string;
    url: string;
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
