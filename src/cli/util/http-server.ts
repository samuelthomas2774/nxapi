import createDebug from 'debug';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorResponse } from '../../api/util.js';
import { temporary_http_errors, temporary_system_errors } from '../../util/errors.js';

const debug = createDebug('cli:util:http-server');

export class HttpServer {
    retry_after = 60;

    protected createApiRequestHandler(callback: (req: Request, res: Response) => Promise<{} | void>, auth = false) {
        return async (req: Request, res: Response) => {
            try {
                const result = await callback.call(null, req, res);

                if (result) this.sendJsonResponse(res, result);
                else res.end();
            } catch (err) {
                this.handleRequestError(req, res, err);
            }
        };
    }

    protected createApiMiddleware(
        callback: (req: Request, res: Response) => Promise<void>
    ): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                await callback.call(null, req, res);

                next();
            } catch (err) {
                this.handleRequestError(req, res, err);
            }
        };
    }

    protected sendJsonResponse(res: Response, data: {}, status?: number) {
        if (status) res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(this.encodeJsonForResponse(data, res.req.headers['accept']?.match(/\/html\b/i) ? 4 : 0));
    }

    protected encodeJsonForResponse(data: unknown, space?: number) {
        return JSON.stringify(data, null, space);
    }

    protected handleRequestError(req: Request, res: Response, err: unknown, retry_after = this.retry_after) {
        debug('Error in request %s %s', req.method, req.url, err);

        if (err instanceof ErrorResponse) {
            const response_retry_after = err.response.headers.get('Retry-After');

            if (response_retry_after && /^\d+$/.test(response_retry_after)) {
                res.setHeader('Retry-After', response_retry_after);
            }

            if (temporary_http_errors.includes(err.response.status) && !response_retry_after) {
                res.setHeader('Retry-After', retry_after);
            }
        }

        if (err && typeof err === 'object' && 'type' in err && 'code' in err && (err as any).type === 'system') {
            const code: string = (err as any).code;

            if (code in temporary_system_errors) {
                res.setHeader('Retry-After', retry_after);
            }
        }

        if (err instanceof ResponseError) {
            err.sendResponse(req, res);
        } else {
            this.sendJsonResponse(res, getErrorObject(err), 500);
        }
    }
}

export class ResponseError extends Error {
    constructor(readonly status: number, readonly code: string, message?: string) {
        super(message);
    }

    sendResponse(req: Request, res: Response) {
        const data = this.toJSON();

        res.statusCode = this.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(req.headers['accept']?.match(/\/html\b/i) ?
            JSON.stringify(data, null, 4) : JSON.stringify(data));
    }

    sendEventStreamEvent(events: EventStreamResponse) {
        events.sendEvent('error', this.toJSON());
    }

    toJSON() {
        return {
            error: this.code,
            error_message: this.message,
        };
    }
}

export class EventStreamResponse {
    json_replacer: ((key: string, value: unknown, data: unknown) => any) | null = null;

    private static id = 0;
    readonly id = EventStreamResponse.id++;

    constructor(
        readonly req: Request,
        readonly res: Response,
    ) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/event-stream');

        console.log('[%s] Event stream %d connected to %s from %s, port %d%s, %s',
            new Date(), this.id, req.url,
            req.socket.remoteAddress, req.socket.remotePort,
            req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
            req.headers['user-agent']);

        res.on('close', () => {
            console.log('[%s] Event stream %d closed', new Date(), this.id);
        });
    }

    sendEvent(event: string | null, ...data: unknown[]) {
        if (event) this.res.write('event: ' + event + '\n');
        for (const d of data) {
            if (d instanceof EventStreamField) d.write(this.res);
            else this.res.write('data: ' + JSON.stringify(d,
                this.json_replacer ? (k, v) => this.json_replacer?.call(null, k, v, d) : undefined) + '\n');
        }
        this.res.write('\n');
    }

    sendErrorEvent(err: unknown) {
        if (err instanceof ResponseError) {
            err.sendEventStreamEvent(this);
        } else {
            this.sendEvent('error', getErrorObject(err));
        }
    }
}

abstract class EventStreamField {
    abstract write(res: Response): void;
}

export class EventStreamLastEventId extends EventStreamField {
    constructor(
        readonly id: string,
    ) {
        super();

        if (!/^[0-9a-z-_\.:;]+$/i.test(id)) {
            throw new TypeError('Invalid event ID');
        }
    }

    write(res: Response) {
        res.write('id: ' + this.id + '\n');
    }
}

export class EventStreamRetryTime extends EventStreamField {
    constructor(
        readonly retry_ms: number,
    ) {
        super();
    }

    write(res: Response) {
        res.write('retry: ' + this.retry_ms + '\n');
    }
}

export class EventStreamRawData extends EventStreamField {
    constructor(
        readonly data: string,
    ) {
        super();

        if (/[\0\n\r]/.test(data)) {
            throw new TypeError('Invalid data');
        }
    }

    write(res: Response) {
        res.write('data: ' + this.data + '\n');
    }
}

function getErrorObject(err: unknown) {
    if (err instanceof ResponseError) {
        return err.toJSON();
    }

    if (err && typeof err === 'object' && 'type' in err && 'code' in err && 'message' in err && err.type === 'system') {
        return {
            error: 'unknown_error',
            error_message: err.message,
            error_code: err.code,
            ...err,
        };
    }

    if (err instanceof Error) {
        return {
            error: 'unknown_error',
            error_message: err.message,
            ...err,
        };
    }

    return {
        error: 'unknown_error',
        error_message: (err as Error)?.message,
        ...(err as object),
    };
}
