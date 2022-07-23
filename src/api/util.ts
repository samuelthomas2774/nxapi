import * as util from 'node:util';
import { Response as NodeFetchResponse } from 'node-fetch';

export class ErrorResponse<T = unknown> extends Error {
    readonly body: string | undefined;
    readonly data: T | undefined = undefined;

    constructor(
        message: string,
        readonly response: Response | NodeFetchResponse,
        body?: string | T
    ) {
        super(message);

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
                }).replace(/\n/g, '\n      ') +
                (lines.length ? '\n' + lines.join('\n') : ''),
        });
    }
}

Object.defineProperty(ErrorResponse, Symbol.hasInstance, {
    configurable: true,
    value: (instance: ErrorResponse) => {
        return instance instanceof Error &&
            'response' in instance &&
            'body' in instance &&
            'data' in instance;
    },
});
