import * as util from 'node:util';
import { AbortError } from 'node-fetch';
import createDebug from './debug.js';
import Loop, { LoopResult } from './loop.js';
import { TemporaryErrorSymbol } from './misc.js';
import { ErrorResponse } from '../api/util.js';

const debug = createDebug('nxapi:util:errors');

export class ErrorDescription {
    constructor(
        readonly type: string,
        readonly message: string,
    ) {}

    static getErrorDescription(err: Error | unknown) {
        if (err instanceof HasErrorDescription) {
            const description = err[ErrorDescriptionSymbol];

            if (description) {
                return description.message +
                    (err instanceof Error ? '\n\n--\n\n' + (err.stack ?? err.message) : '');
            }
        }

        if (err instanceof Error) {
            return err.stack || err.message;
        }

        return util.inspect(err, {compact: true});
    }
}

export const ErrorDescriptionSymbol = Symbol('ErrorDescription');

export abstract class HasErrorDescription {
    abstract get [ErrorDescriptionSymbol](): ErrorDescription | null;
}

Object.defineProperty(HasErrorDescription, Symbol.hasInstance, {
    configurable: true,
    value: (instance: HasErrorDescription) => {
        return instance && ErrorDescriptionSymbol in instance;
    },
});

export const temporary_system_errors = {
    'ETIMEDOUT': 'request timed out',
    'ENOTFOUND': null,
    'EAI_AGAIN': 'name resolution failed',
    'ECONNRESET': 'connection reset',
    'ENETUNREACH': 'network unreachable',
};
export const temporary_http_errors = [
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout

    // Non-standard Cloudflare status codes
    521, // Web Server Is Down
    522, // Connection Timed Out
    523, // Origin Is Unreachable
    524, // A Timeout Occurred
    530, // Unknown (1xxx error)
];

export async function handleError(
    err: ErrorResponse | NodeJS.ErrnoException,
    loop: Loop,
): Promise<LoopResult> {
    if (TemporaryErrorSymbol in err && err[TemporaryErrorSymbol]) {
        debug('Temporary error, waiting %ds before retrying', loop.update_interval, err);

        return LoopResult.OK;
    } else if (err instanceof AbortError) {
        debug('Request aborted (timeout?), waiting %ds before retrying', loop.update_interval, err);

        return LoopResult.OK;
    } else if ('code' in err && (err as any).type === 'system' && err.code && err.code in temporary_system_errors) {
        const desc = temporary_system_errors[err.code as keyof typeof temporary_system_errors];
        debug('Request error%s, waiting %ds before retrying', desc ? ' - ' + desc : '', loop.update_interval, err);

        return LoopResult.OK;
    } else if (err instanceof ErrorResponse && temporary_http_errors.includes(err.response.status)) {
        debug('Request error - HTTP %s (%s), waiting %ds before retrying',
            err.response.status, err.response.statusText, loop.update_interval, err);

        return LoopResult.OK;
    } else {
        throw err;
    }
}
