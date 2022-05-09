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
