import { Agent, buildConnector, Dispatcher, errors } from 'undici';
import createDebug from './debug.js';

const debug = createDebug('nxapi:util:undici-proxy');

function defaultProtocolPort(protocol: string) {
    return protocol === 'https:' ? 443 : 80;
}

export interface ProxyAgentOptions {
    agent?: Agent;
    requestTls?: buildConnector.BuildOptions;
}

export function buildProxyAgent(options: ProxyAgentOptions & {
    resolveProxy: (origin: string) => Promise<URL | null>;
}) {
    const agent = options.agent ?? new Agent();
    const connectEndpoint = buildConnector(options.requestTls ?? {});

    return new Agent({
        connect: async (opts, callback) => {
            let requestedHost = opts.host!;

            if (!opts.port) {
                requestedHost += `:${defaultProtocolPort(opts.protocol)}`;
            }

            try {
                const request_origin = opts.protocol + '//' + opts.hostname +
                    (opts.port ? ':' + opts.port : '');

                const proxy = await options.resolveProxy.call(null, request_origin);

                debug('resolved proxy for %s as %s', request_origin, proxy?.toString());

                if (!proxy) {
                    connectEndpoint(opts, callback);
                    return;
                }

                const { origin, port, host } = proxy;

                const { socket, statusCode } = await agent.connect({
                    // @ts-expect-error
                    origin,
                    port,
                    path: requestedHost,
                    // @ts-expect-error
                    signal: opts.signal,
                    headers: {
                        host,
                    },
                }) as unknown as Dispatcher.ConnectData;

                if (statusCode !== 200) {
                    socket.on('error', () => {}).destroy();
                    callback(new errors.RequestAbortedError('Proxy response !== 200 when HTTP Tunneling'), null);
                }

                if (opts.protocol !== 'https:') {
                    // @ts-expect-error
                    callback(null, socket);
                    return;
                }

                // @ts-expect-error
                connectEndpoint({ ...opts, httpSocket: socket }, callback);
            } catch (err) {
                callback(err as Error, null);
            }
        },
    });
}

export function buildEnvironmentProxyAgent(options?: ProxyAgentOptions) {
    return buildProxyAgent({
        ...options,
        resolveProxy: resolveProxyFromEnvironment,
    });
}

export async function resolveProxyFromEnvironment(origin: string) {
    const { protocol } = new URL(origin);

    if (protocol === 'http:' && process.env.HTTP_PROXY) {
        return new URL(process.env.HTTP_PROXY);
    }
    if (protocol === 'https:' && process.env.HTTPS_PROXY) {
        return new URL(process.env.HTTPS_PROXY);
    }

    return null;
}
