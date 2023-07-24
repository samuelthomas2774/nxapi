import { Buffer } from 'node:buffer';
import { fetch, Headers, Response } from 'undici';
import createDebug from './debug.js';

const debug = createDebug('nxapi:util:eventsource');

export class ErrorEvent extends Event {
    constructor(
        readonly error: Error,
        readonly message = error.message,
    ) {
        super('error');
    }
}

export enum EventSourceReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2,
}

export interface EventSourceInit extends globalThis.EventSourceInit {
    authorisation?: string | (() => string);
    useragent?: string;
}

type Listener<T extends string> =
    T extends 'error' ? [type: T, handler: (error: ErrorEvent) => void] :
    T extends 'open' ? [type: T, handler: (event: Event) => void] :
    [type: T, handler: (event: MessageEvent<string>) => void];

export default class EventSource {
    protected static connections = new Set<EventSource>();

    protected _connecting: Promise<Response> | null = null;
    protected _response: Response | null = null;
    protected _controller: AbortController | null = null;
    protected _reconnect_timeout: NodeJS.Timeout | null = null;
    protected _closed = false;

    protected _id: string | null = null;
    protected _retry_after: number | null = null;

    protected readonly _authorisation: string | (() => string) | null = null;
    protected readonly _useragent: string | null = null;

    readonly withCredentials = false;

    onerror?: (error: ErrorEvent) => void;
    onmessage?: (message: MessageEvent<string>) => void;
    onopen?: (event: Event) => void;

    onAnyMessage?: (message: MessageEvent<string>) => void;

    protected readonly _listeners: Listener<string>[] = [];

    constructor(readonly url: string, init?: EventSourceInit) {
        if (init?.withCredentials) debug('init.withCredentials is not supported');
        if (init?.authorisation) this._authorisation = init.authorisation;
        if (init?.useragent) this._useragent = init.useragent;

        Object.defineProperty(this, '_connecting', {enumerable: false});
        Object.defineProperty(this, '_response', {enumerable: false});
        Object.defineProperty(this, '_controller', {enumerable: false});
        Object.defineProperty(this, '_reconnect_timeout', {enumerable: false});
        Object.defineProperty(this, '_closed', {enumerable: false});
        Object.defineProperty(this, '_id', {enumerable: false});
        Object.defineProperty(this, '_retry_after', {enumerable: false});
        Object.defineProperty(this, '_authorisation', {enumerable: false});
        Object.defineProperty(this, '_useragent', {enumerable: false});
        Object.defineProperty(this, 'onerror', {enumerable: false, writable: true});
        Object.defineProperty(this, 'onmessage', {enumerable: false, writable: true});
        Object.defineProperty(this, 'onopen', {enumerable: false, writable: true});
        Object.defineProperty(this, 'onAnyMessage', {enumerable: false, writable: true});
        Object.defineProperty(this, '_listeners', {enumerable: false});
        Object.defineProperty(this, '_message_event', {enumerable: false});
        Object.defineProperty(this, '_message_data', {enumerable: false});
        Object.defineProperty(this, '_message_id', {enumerable: false});

        EventSource.connections.add(this);

        this._connect();
    }

    get readyState(): EventSourceReadyState {
        if (this._closed) return EventSourceReadyState.CLOSED;
        if (this._response) return EventSourceReadyState.OPEN;
        return EventSourceReadyState.CONNECTING;
    }

    get response(): Response | null {
        return this._response;
    }

    addEventListener<T extends string>(event: T, handler: Listener<T>[1]) {
        this._listeners.push([event, handler]);
    }

    removeEventListener<T extends string>(event: T, handler?: Listener<T>[1]) {
        let index;
        while ((index = this._listeners.findIndex(listener =>
            listener[0] === event && (!handler || listener[1] === handler)
        )) >= 0) {
            this._listeners.splice(index, 1);
        }
    }

    protected _fetch(signal: AbortSignal) {
        const headers = new Headers({
            'Accept': 'text/event-stream',
        });

        const authorisation = typeof this._authorisation === 'function' ?
            this._authorisation.call(null) : this._authorisation;
        if (authorisation) headers.append('Authorization', authorisation);

        if (this._useragent) headers.append('User-Agent', this._useragent);

        if (typeof this._id === 'string') {
            headers.append('Last-Event-Id', this._id);
        }

        debug('Connecting', this);

        return fetch(this.url, {
            headers,
            signal,
            keepalive: true,
        });
    }

    protected _connect() {
        if (this._closed || this._connecting) {
            return;
        }

        if (this._reconnect_timeout) {
            clearTimeout(this._reconnect_timeout);
            this._reconnect_timeout = null;
        }

        this._controller?.abort();

        const controller = new AbortController();
        const connecting = this._fetch(controller.signal);

        this._response = null;
        this._controller = controller;
        this._connecting = connecting;

        connecting.then(async response => {
            const url = new URL(this.url);
            url.search = '';
            url.hash = '';

            debug('fetch %s %s, response %s', 'GET', url, response.status);

            if (this._closed || this._controller !== controller) {
                controller.abort();
                return;
            }

            this._response = response;
            this._connecting = null;

            if (!response.ok) {
                debug('Non-200 response code', await response.text());
                controller.abort();
                return this._handleConnectionClosed();
            }

            if (!response.headers.get('Content-Type')?.match(/^text\/event-stream($|;)/)) {
                debug('Response type is not text/event-stream', await response.text());
                controller.abort();
                return this._handleConnectionClosed();
            }

            if (!response.body) {
                debug('Response does not include a body');
                controller.abort();
                return this._handleConnectionClosed();
            }

            debug('Connected to %s', url);

            const event = new Event('open');
            this.dispatchEvent(event);

            const reader = response.body.getReader();

            return this._handleResponseStream(reader);
        }).then(() => {
            this._handleConnectionClosed();
        }, err => {
            this._handleConnectionClosed(err);
        });
    }

    protected async _handleResponseStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
        let buffer = Buffer.alloc(0);
        const n = '\n'.charCodeAt(0);

        let value: Uint8Array | undefined;
        let done = false;

        while (!done) {
            ({value, done} = await reader.read());

            if (!value) continue;

            let index;
            while ((index = value.findIndex(v => v === n)) >= 0) {
                const line = Buffer.concat([buffer, value.slice(0, index)]);
                if (buffer.length) buffer = Buffer.alloc(0);
                value = value.slice(index + 1);

                this._handleLine(new Uint8Array(line));
            }

            // Move any remaining data
            buffer = Buffer.concat([buffer, value]);
        }
    }

    _message_event: string | null = null;
    _message_data: Uint8Array | null = null;
    _message_id: string | null = null;

    protected _handleLine(line: Uint8Array) {
        if (line.length === 0) {
            const event = new MessageEvent(this._message_event ?? 'message', {
                data: this._message_data ? new TextDecoder().decode(this._message_data) : '',
                lastEventId: this._message_id ?? undefined,
                // source: this as unknown as MessageEventSource,
            });

            this._message_data = null;

            this.onAnyMessage?.call(this, event);

            if (typeof this._message_event === 'string') {
                for (const [type, handler] of this._listeners) {
                    if (type !== this._message_event) continue;

                    handler.call(this, event);
                }

                this._message_event = null;
            } else {
                this.onmessage?.call(null, event);

                for (const [type, handler] of this._listeners) {
                    if (type !== 'message') continue;

                    handler.call(this, event);
                }
            }

            if (typeof this._message_id === 'string') {
                this._id = this._message_id;
                this._message_id = null;
            }

            return;
        }

        const index = line.indexOf(':'.charCodeAt(0));
        if (index < 0) return;

        const tag = new TextDecoder().decode(line.slice(0, index));
        const data = line.slice(index + (line[index + 1] === ' '.charCodeAt(0) ? 2 : 1));

        if (tag === 'event') {
            this._message_event = new TextDecoder().decode(data);
        } else if (tag === 'data') {
            this._message_data = this._message_data ?
                new Uint8Array(Buffer.concat([this._message_data, Buffer.from('\n'), data])) :
                data;
        } else if (tag === 'id') {
            this._message_id = new TextDecoder().decode(data);
        } else if (tag === 'retry') {
            const retry = parseInt(new TextDecoder().decode(data));
            if (!isNaN(retry)) this._retry_after = retry;
        } else if (tag) {
            debug('Unknown message type "%s"', tag);
        }
    }

    protected async _handleConnectionClosed(error?: Error) {
        this._response = null;

        if (this._closed) {
            return;
        }

        if (error) {
            const event = new ErrorEvent(error);

            this.dispatchEvent(event);
        }

        const wait = Math.max(1000, this._retry_after ?? 0);

        clearTimeout(this._reconnect_timeout!);
        this._reconnect_timeout = setTimeout(() => this._connect(), wait);
    }

    close() {
        debug('Closing', this);

        this._closed = true;
        this._controller?.abort();
        EventSource.connections.delete(this);
    }

    dispatchEvent(event: Event) {
        // @ts-expect-error
        this['on' + event.type]?.call(this, event);

        for (const [type, handler] of this._listeners as Listener<string>[]) {
            if (type !== event.type) continue;

            // @ts-expect-error
            handler.call(this, event);
        }
    }
}
