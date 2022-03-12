import { Response } from 'node-fetch';

export class ErrorResponse<T = unknown> extends Error {
    constructor(
        message: string,
        readonly response: Response,
        readonly data: T = undefined as any
    ) {
        super(message);
    }
}
