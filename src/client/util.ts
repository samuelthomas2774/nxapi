import createDebug from '../util/debug.js';
import { LIMIT_PERIOD, LIMIT_REQUESTS } from '../common/auth/util.js';
import { NintendoAccountSession } from './storage/index.js';

const debug = createDebug('nxapi:client:util');

export async function checkUseLimit(
    session: NintendoAccountSession<unknown>,
    key: string,
    /** Set to false to count the attempt but ignore the limit */ ratelimit = true,
    /** [requests, period_ms] */ limits: [number, number] = [LIMIT_REQUESTS, LIMIT_PERIOD]
) {
    let attempts = await session.getRateLimitAttempts(key);
    attempts = attempts.filter(a => a >= Date.now() - limits[1]);

    if (ratelimit && attempts.length >= limits[0]) {
        throw new Error('Too many attempts to authenticate');
    }

    attempts.unshift(Date.now());
    await session.setRateLimitAttempts(key, attempts);
}
