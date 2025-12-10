import * as util from 'node:util';
import * as persist from 'node-persist';
import createDebug from '../../util/debug.js';
import { ErrorDescription, ErrorDescriptionSymbol, HasErrorDescription } from '../../util/errors.js';
import { SavedToken } from './coral.js';

const debug = createDebug('nxapi:auth:util');

// If the parent process is a terminal, then the user is attempting to run the command manually,
// so we shouldn't restrict how many attempts they can use. If not, the command is being run by
// a script/some other program, which should be limited in case it continues to run the command
// if it fails. The Electron app overrides this as the parent process (probably) won't be a
// terminal, but most attempts to call getToken won't be automated.
// Node.js docs recommend using process.stdout.isTTY (see https://github.com/samuelthomas2774/nxapi/issues/15).
export const SHOULD_LIMIT_USE = !process.stdin.isTTY || !process.stderr.isTTY;
export const LIMIT_REQUESTS = 4;
export const LIMIT_PERIOD = 60 * 60 * 1000; // 60 minutes

export async function checkUseLimit(
    storage: persist.LocalStorage,
    key: string, user: string,
    /** Set to false to count the attempt but ignore the limit */ ratelimit = true,
    limits: [requests: number, period_ms: number] = [LIMIT_REQUESTS, LIMIT_PERIOD]
) {
    let attempts: SavedRateLimitAttempt[] = await storage.getItem('RateLimitAttempts-' + key + '.' + user) ?? [];
    if (typeof attempts[0] === 'number') attempts = attempts.map((a: SavedRateLimitAttempt | number) =>
        typeof a === 'number' ? {time: a} : a);
    attempts = attempts.filter(a => a.time >= Date.now() - limits[1]);

    if (ratelimit && attempts.length >= limits[0]) {
        for (const attempt of attempts) decorateRateLimitAttempt(attempt);
        throw new RateLimitError('Too many attempts to authenticate (' + key + ')', key, attempts);
    }

    const attempt = new RateLimitAttempt(storage, key, user);
    debug('rl attempt', attempt, attempts.length, limits[0]);

    attempts.unshift({time: attempt.time});
    await storage.setItem('RateLimitAttempts-' + key + '.' + user, attempts);

    return attempt;
}

class RateLimitAttempt {
    constructor(
        readonly storage: persist.LocalStorage,
        readonly key: string, readonly user: string,
        readonly time = Date.now(),
    ) {
        Object.defineProperty(this, 'storage', {configurable: true, enumerable: false, value: storage});
    }

    async recordError(err: Error | unknown) {
        const error_description = ErrorDescription.getErrorDescription(err);
        const error_description_data = err instanceof HasErrorDescription ? err[ErrorDescriptionSymbol] : null;
        await this.recordErrorData(error_description, err, error_description_data);
    }

    async recordErrorData(error_description: string, data: unknown, error_description_data?: ErrorDescription | null) {
        const key = 'RateLimitAttempts-' + this.key + '.' + this.user;
        let attempts: SavedRateLimitAttempt[] = await this.storage.getItem(key) ?? [];

        const attempt = attempts.find(a => a.time === this.time);
        if (!attempt) return;

        attempt.error_description = error_description;
        attempt.error_description_data = error_description_data ?? undefined;
        attempt.error_data = data;

        await this.storage.setItem(key, attempts);
    }
}

interface SavedRateLimitAttempt {
    time: number;
    error_description?: string;
    error_description_data?: {
        type: string;
        message: string;
    };
    error_data?: unknown;
}

function decorateRateLimitAttempt(attempt: SavedRateLimitAttempt) {
    Object.defineProperty(attempt, util.inspect.custom, {value: inspectRateLimitAttempt});
}

function inspectRateLimitAttempt(
    this: SavedRateLimitAttempt,
    depth: number, options: util.InspectOptionsStylized, inspect: typeof util.inspect,
) {
    const time = options.stylize('RateLimitAttempt', 'special') + ' ' + new Date(this.time);

    if (!this.error_description) {
        return time + ' ' + options.stylize('[no error]', 'undefined');
    } else if (depth < 0) {
        return time + ' ' + options.stylize('[error hidden]', 'undefined');
    } else {
        return time + '\n' + this.error_description + ' ' + inspect(this.error_data, {
            ...options,
            depth: options.depth ? options.depth - 1 : null,
        });
    }
}

export class RateLimitError extends Error implements HasErrorDescription {
    constructor(
        message: string,
        readonly key: string,
        readonly attempts: SavedRateLimitAttempt[],
    ) {
        super(message);
    }

    get [ErrorDescriptionSymbol]() {
        return new ErrorDescription('auth.use_limit_exceeded', 'Too many attempts to authenticate.');
    }
}

export function checkMembershipActive(data: SavedToken) {
    // Since 3.2.0 we can't check if the user has an active NSO membership
    if (!('nintendoAccount' in data.nsoAccount.user.links)) return;

    const membership = data.nsoAccount.user.links.nintendoAccount.membership;
    const active = typeof membership.active === 'object' ? (membership.active as typeof membership).active : membership.active;

    if (!active) throw new MembershipRequiredError('Nintendo Switch Online membership required');
}

export class MembershipRequiredError extends Error implements HasErrorDescription {
    get [ErrorDescriptionSymbol]() {
        return new ErrorDescription('auth.nso_membership_required', 'Nintendo Switch Online membership required.\n\nMake sure your account has an active Nintendo Switch Online membership. It may take up to two hours for your membership status to update.');
    }
}
