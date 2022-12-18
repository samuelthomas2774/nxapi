import * as util from 'node:util';
import { Response as NodeFetchResponse } from 'node-fetch';

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
        readonly response: Response | NodeFetchResponse,
        body?: string | T
    ) {
        super(message);

        Object.defineProperty(this, ErrorResponseSymbol, {enumerable: false, value: ErrorResponseSymbol});

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
}

Object.defineProperty(ErrorResponse, Symbol.hasInstance, {
    configurable: true,
    value: (instance: ErrorResponse) => {
        return instance && ErrorResponseSymbol in instance;
    },
});
