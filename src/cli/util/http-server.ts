import createDebug from 'debug';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorResponse } from '../../api/util.js';

const debug = createDebug('cli:util:http-server');

export class HttpServer {
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

    protected handleRequestError(req: Request, res: Response, err: unknown) {
        if (err instanceof ErrorResponse) {
            const retry_after = err.response.headers.get('Retry-After');

            if (retry_after && /^\d+$/.test(retry_after)) {
                res.setHeader('Retry-After', retry_after);
            }
        }

        if (err && 'type' in err && 'code' in err && (err as any).type === 'system') {
            const code: string = (err as any).code;

            if (code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
                res.setHeader('Retry-After', '60');
            }
        }

        if (err instanceof ResponseError) {
            err.sendResponse(req, res);
        } else {
            this.sendJsonResponse(res, {
                error: err,
                error_message: (err as Error).message,
            }, 500);
        }
    }
}

export class ResponseError extends Error {
    constructor(readonly status: number, readonly code: string, message?: string) {
        super(message);
    }

    sendResponse(req: Request, res: Response) {
        const data = {
            error: this.code,
            error_message: this.message,
        };

        res.statusCode = this.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(req.headers['accept']?.match(/\/html\b/i) ?
            JSON.stringify(data, null, 4) : JSON.stringify(data));
    }
}

export class EventStreamResponse {
    json_replacer: ((key: string, value: unknown) => any) | null = null;

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
        for (const d of data) this.res.write('data: ' + JSON.stringify(d, this.json_replacer ?? undefined) + '\n');
        this.res.write('\n');
    }
}
