import * as net from 'node:net';

export function parseListenAddress(address: string | number) {
    const match = ('' + address).match(/^((?:((?:\d+\.){3}\d+)|\[(.*)\]):)?(\d+)$/);
    if (!match || (match[1] && !net.isIP(match[2] || match[3]))) throw new Error('Invalid address/port');

    const host = match[2] || match[3] || null;
    const port = parseInt(match[4]);

    return [host, port] as const;
}
