import createDebug from 'debug';
import Loop, { LoopResult } from './loop.js';
import { CoralErrorResponse } from '../api/coral-types.js';
import { ErrorResponse } from '../api/util.js';
import { TemporaryErrorSymbol } from './misc.js';

const debug = createDebug('nxapi:util:errors');

export const temporary_system_errors = {
    'ETIMEDOUT': 'request timed out',
    'ENOTFOUND': null,
    'EAI_AGAIN': 'name resolution failed',
    'ECONNRESET': 'connection reset',
};
export const temporary_http_errors = [
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];

export async function handleError(
    err: ErrorResponse<CoralErrorResponse> | NodeJS.ErrnoException,
    loop: Loop,
): Promise<LoopResult> {
    if (TemporaryErrorSymbol in err && err[TemporaryErrorSymbol]) {
        debug('Temporary error, waiting %ds before retrying', loop.update_interval, err);

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
