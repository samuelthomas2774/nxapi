import * as util from 'node:util';
import { Response as UndiciResponse } from 'undici';

export const ResponseSymbol = Symbol('Response');
const ErrorResponseSymbol = Symbol('IsErrorResponse');

export interface ResponseData<R> {
    [ResponseSymbol]: R;
}
export type HasResponse<T, R> = T & ResponseData<R>;

export function defineResponse<T, R>(data: T, response: R) {
    Object.defineProperty(data, ResponseSymbol, {enumerable: false, value: response});
    return data as HasResponse<T, R>;
}

export class ErrorResponse<T = unknown> extends Error {
    readonly body: string | undefined;
    readonly data: T | undefined = undefined;

    constructor(
        message: string,
        readonly response: Response | UndiciResponse,
        body?: string | ArrayBuffer | T
    ) {
        super(message);

        Object.defineProperty(this, ErrorResponseSymbol, {enumerable: false, value: ErrorResponseSymbol});

        if (response.status === 502 &&
            response.headers.get('Server') === 'cloudflare' &&
            response.headers.get('Content-Type')?.match(/^text\/html(;|$)/)
        ) {
            // Cloudflare returns it's own HTML error page for HTTP 502 errors
            // Logging this isn't helpful so just discard it
            body = 'Bad Gateway\n';
        }

        if (body instanceof ArrayBuffer) {
            body = (new TextDecoder()).decode(body);
        }

        if (typeof body === 'string') {
            this.body = body;
            try {
                this.data = body ? JSON.parse(body) : undefined;
            } catch (err) {}
        } else if (typeof body !== 'undefined') {
            this.data = body;
        }

        const stack = this.stack ?? (this.name + ': ' + message);
        const lines = stack.split('\n');
        const head = lines.shift()!;

        Object.defineProperty(this, 'stack', {
            value: head + '\n' +
                '    from ' + response.url + ' (' + response.status + ' ' + response.statusText + ')\n' +
                '      ' + util.inspect(this.data ? this.data : this.body, {
                    compact: true,
                    maxStringLength: 100,
                }).replace(/\n/g, '\n      ') +
                (lines.length ? '\n' + lines.join('\n') : ''),
        });
    }

    static async fromResponse<T>(response: UndiciResponse, message: string) {
        const body = await response.arrayBuffer();

        return new this<T>(message, response, body);
    }
}

Object.defineProperty(ErrorResponse, Symbol.hasInstance, {
    configurable: true,
    value: (instance: ErrorResponse) => {
        return instance && ErrorResponseSymbol in instance;
    },
});
