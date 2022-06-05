import { EventEmitter } from 'node:events';
import React, { useEffect } from 'react';
import { ColorSchemeName, Platform, StyleProp, StyleSheet, useColorScheme, View, ViewStyle } from 'react-native';
import type { User as DiscordUser } from 'discord-rpc';
import { ErrorResponse } from '../../api/util.js';
import { DiscordPresence } from '../../discord/util.js';
import ipc, { events } from './ipc.js';
import { User } from './app.js';
import { SavedToken } from '../../common/auth/nso.js';

export function Root(props: React.PropsWithChildren<{
    title?: string;
    titleUser?: User | SavedToken;
    style?: StyleProp<ViewStyle>;
    scrollable?: boolean;
}>) {
    const colour_scheme = useColorScheme();

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    useEffect(() => {
        const user_na = props.titleUser?.user;
        const user_nso = (props.titleUser && 'nso' in props.titleUser ? props.titleUser.nso : props.titleUser)?.nsoAccount.user;
        const user_prefix =
            user_na ? '[' + user_na.nickname +
                (user_nso && user_nso.name !== user_na.nickname ? '/' + user_nso.name : '') +
            '] ' : '';

        document.title = user_prefix + (props.title ?? 'Nintendo Switch Online');
    }, [props.title, props.titleUser]);

    return <ColourSchemeContext.Provider value={colour_scheme}>
        <AccentColourContext.Provider value={accent_colour}>
            <View style={[props.scrollable ? styles.appScrollable : styles.app, props.style]}>
                {props.children}
            </View>
        </AccentColourContext.Provider>
    </ColourSchemeContext.Provider>;
}

const styles = StyleSheet.create({
    app: {
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    appScrollable: {
        minHeight: Platform.OS === 'web' ? '100vh' : '100%',
    },
});

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

export function useEventListener<
    T extends EventEmitter,
    E extends Parameters<T['on']>[0],
    L extends Parameters<T['on']>[1],
>(events: T, event: E, listener: L, deps: any[]) {
    React.useEffect(() => {
        events.on(event, listener);

        return () => {
            events.removeListener(event, listener);
        };
    }, deps);
}

export const AccentColourContext = React.createContext<string | null>('E60012FF');

export function useAccentColour() {
    return React.useContext(AccentColourContext);
}

export const ColourSchemeContext = React.createContext<ColorSchemeName>(null);

export function useColourScheme() {
    return React.useContext(ColourSchemeContext);
}

export function useDiscordPresenceSource() {
    const [source, , state, forceRefresh] = useAsync(React.useCallback(() => ipc.getDiscordPresenceSource(), [ipc]));
    useEventListener(events, 'update-discord-presence-source', forceRefresh, []);
    return [source, state] as const;
}

export function useActiveDiscordPresence() {
    const [presence, setPresence] = React.useState<DiscordPresence | null>(null);
    useEventListener(events, 'update-discord-presence', setPresence, []);

    React.useEffect(() => {
        ipc.getDiscordPresence().then(setPresence);
    }, [ipc]);

    return presence;
}

export function useActiveDiscordUser() {
    const [user, setUser] = React.useState<DiscordUser | null>(null);
    useEventListener(events, 'update-discord-user', setUser, []);

    React.useEffect(() => {
        ipc.getDiscordUser().then(setUser);
    }, [ipc]);

    return user;
}
