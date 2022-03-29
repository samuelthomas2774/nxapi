import * as React from 'react';

export enum RequestState {
    NOT_LOADING,
    LOADING,
    LOADED,
}

export function useAsync<T>(fetch: (() => Promise<T>) | null) {
    const [[data, requestState, error, i], setData] =
        React.useState([null as T | null, RequestState.NOT_LOADING, null as Error | null, 0]);
    const [f, forceUpdate] = React.useReducer(f => !f, false);

    React.useEffect(() => {
        if (!fetch) {
            setData(p => p[1] === RequestState.NOT_LOADING ? p : [data, RequestState.NOT_LOADING, null, p[3] + 1]);
            return;
        }

        setData(p => [p[0], RequestState.LOADING, p[2], i + 1]);

        fetch.call(null).then(data => {
            setData(p => p[3] === i + 1 ? [data, RequestState.LOADED, null, i + 1] : p);
        }, err => {
            setData(p => p[3] === i + 1 ? [data, RequestState.LOADED, err, i + 1] : p);
        });
    }, [fetch, f]);

    return [data, error, requestState, forceUpdate] as const;
}

export function useFetch<T>(requestInfo: RequestInfo | null, init: RequestInit | undefined, then: (res: Response) => Promise<T>): [T | null, Error | null, RequestState, React.DispatchWithoutAction]
export function useFetch(requestInfo: RequestInfo | null, init?: RequestInit): [Response | null, Error | null, RequestState, React.DispatchWithoutAction]
export function useFetch<T>(requestInfo: RequestInfo | null, init?: RequestInit, then?: (res: Response) => Promise<T>) {
    const f = React.useCallback(async () => {
        const response = await fetch(requestInfo!, init);
        return then?.call(null, response) ?? response;
    }, [requestInfo]);

    return useAsync<T | Response>(requestInfo ? f : null);
}

export class ErrorResponse extends Error {
    readonly data: any | undefined = undefined;

    constructor(message: string, readonly response: Response, readonly body?: string) {
        super(message);

        try {
            this.data = body ? JSON.parse(body) : undefined;
        } catch (err) {}
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

export function useFetchJson<T>(requestInfo: RequestInfo | null, init?: RequestInit) {
    return useFetch(requestInfo, init, response => {
        if (response.status !== 200) {
            return response.text().then(body => {
                throw new ErrorResponse(
                    'Server returned a non-200 status code: ' + response.status + ' ' + response.statusText,
                    response, body);
            });
        }

        return response.json() as Promise<T>;
    });
}

export function useFetchText(requestInfo: RequestInfo | null, init?: RequestInit) {
    return useFetch(requestInfo, init, response => response.text());
}
