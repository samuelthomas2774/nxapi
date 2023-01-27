import { EventEmitter } from 'node:events';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ColorSchemeName, I18nManager, LayoutChangeEvent, Platform, StyleProp, StyleSheet, useColorScheme, View, ViewStyle } from 'react-native';
import { i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import type { User as DiscordUser } from 'discord-rpc';
import { ErrorResponse } from '../../api/util.js';
import { DiscordPresence } from '../../discord/types.js';
import ipc, { events } from './ipc.js';
import { NintendoAccountUser } from '../../api/na.js';
import { SavedToken } from '../../common/auth/coral.js';
import { SavedMoonToken } from '../../common/auth/moon.js';
import { BACKGROUND_COLOUR_MAIN_DARK, BACKGROUND_COLOUR_MAIN_LIGHT, DEFAULT_ACCENT_COLOUR } from './constants.js';
import createI18n from '../i18n/index.js';

export const WindowFocusedContext = React.createContext(false);

export function Root(props: React.PropsWithChildren<{
    title?: string | ((i18n: i18n) => string);
    titleUser?: User | SavedToken;
    style?: StyleProp<ViewStyle>;
    scrollable?: boolean;
    autoresize?: boolean;
    vibrancy?: boolean;
    i18nNamespace?: string | string[];
}>) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [window_focused, setWindowFocus] = useState(true);

    useEffect(() => {
        const handler = (event: FocusEvent) => setWindowFocus(event.type === 'focus');
        window.addEventListener('focus', handler);
        window.addEventListener('blur', handler);
        return () => {
            window.removeEventListener('focus', handler);
            window.removeEventListener('blur', handler);
        };
    }, []);

    const [i18n, i18n_error] = useAsync(useCallback(async () => {
        const i18n = createI18n();

        // @ts-expect-error
        window.i18n = i18n;

        await i18n
            .use(LanguageDetector as unknown as typeof import('i18next-browser-languagedetector').default)
            .use(initReactI18next)
            .init();

        await i18n.loadNamespaces('app');
        if (props.i18nNamespace) await i18n.loadNamespaces(props.i18nNamespace);

        return i18n;
    }, []));

    if (i18n_error) throw i18n_error;

    useEventListener(events, 'update-language', language => i18n?.changeLanguage(language), [i18n]);

    // Force rerender when language changes so the window title is updated
    const [language, setCurrentLanguage] = useState();
    useEffect(() => {
        i18n?.on('languageChanged', setCurrentLanguage);
        return () => i18n?.off('languageChanged', setCurrentLanguage);
    }, [i18n]);

    useAsync(useCallback(async () => i18n?.loadNamespaces('app'), [i18n, language]));
    useAsync(useCallback(async () => props.i18nNamespace && i18n?.loadNamespaces(props.i18nNamespace),
        [i18n, props.i18nNamespace, language]));

    const [preventingFocus, setPreventFocus] = useState(true);
    const unlockFocus = useCallback(() => setPreventFocus(false), []);
    useLayoutEffect(() => setPreventFocus(props.autoresize ?? true), [props.autoresize]);

    const onLayout = useCallback(async (event: LayoutChangeEvent) => {
        if (!event.nativeEvent.layout.height) return;

        await ipc.setWindowHeight(event.nativeEvent.layout.height);
        setPreventFocus(false);
    }, []);

    useEffect(() => {
        document.documentElement.style.overflowY = props.scrollable ? 'auto' : 'hidden';
    }, [props.scrollable]);

    const title_user_prefix = useMemo(() => {
        const user_na = props.titleUser?.user;
        const user_nso = (props.titleUser && 'nso' in props.titleUser ? props.titleUser.nso : props.titleUser)?.nsoAccount.user;

        return user_na ? '[' + user_na.nickname +
            (user_nso && user_nso.name !== user_na.nickname ? '/' + user_nso.name : '') +
        '] ' : '';
    }, [props.titleUser]);

    if (!i18n) return null;

    const content = <View style={[
        props.scrollable ? styles.appScrollable : styles.app,
        !props.vibrancy ? theme.appNoVibrancy : null,
        props.style,
    ]}>
        {props.autoresize && preventingFocus ? <View
            key={'focuslock'}
            focusable
            // @ts-expect-error react-native-web
            onFocus={unlockFocus}
        /> : null}

        {props.autoresize ? <View
            key={'autoresize'}
            onLayout={props.autoresize ? onLayout : undefined}
        >{props.children}</View> : props.children}
    </View>;

    return <ColourSchemeContext.Provider value={colour_scheme}>
        <AccentColourContext.Provider value={accent_colour ?? DEFAULT_ACCENT_COLOUR}>
            <WindowFocusedContext.Provider value={window_focused}>
                <I18nextProvider i18n={i18n}>
                    <WindowTitle title={title_user_prefix + (
                        typeof props.title === 'function' ? props.title.call(null, i18n) :
                        props.title ?? i18n.t('app:default_title'))} />

                    {content}
                </I18nextProvider>
            </WindowFocusedContext.Provider>
        </AccentColourContext.Provider>
    </ColourSchemeContext.Provider>;
}

function WindowTitle(props: {
    title: string;
}) {
    useEffect(() => {
        document.title = props.title;
    }, [props.title]);

    return null;
}

const styles = StyleSheet.create({
    app: {
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    appScrollable: {
        minHeight: Platform.OS === 'web' ? '100vh' : '100%',
    },
});

const light = StyleSheet.create({
    appNoVibrancy: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_LIGHT,
    },
});

const dark = StyleSheet.create({
    appNoVibrancy: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_DARK,
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

export const AccentColourContext = React.createContext<string>(DEFAULT_ACCENT_COLOUR);

export function useAccentColour() {
    return React.useContext(AccentColourContext);
}

export const ColourSchemeContext = React.createContext<ColorSchemeName>(null);

export function useColourScheme() {
    return React.useContext(ColourSchemeContext);
}

export interface User {
    user: NintendoAccountUser;
    nso: SavedToken | null;
    nsotoken: string | undefined;
    moon: SavedMoonToken | null;
    moontoken: string | undefined;
}

export async function getAccounts() {
    const ids = await ipc.listNintendoAccounts();

    const accounts: User[] = [];

    for (const id of ids ?? []) {
        const nsotoken = await ipc.getNintendoAccountCoralToken(id);
        const moontoken = await ipc.getNintendoAccountMoonToken(id);

        const nso = nsotoken ? await ipc.getSavedCoralToken(nsotoken) ?? null : null;
        const moon = moontoken ? await ipc.getSavedMoonToken(moontoken) ?? null : null;

        if (!nso && !moon) continue;

        accounts.push({user: nso?.user ?? moon!.user, nso, nsotoken, moon, moontoken});
    }

    return accounts;
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

export function useTimeSince(time: Date, short = false) {
    const [now, setNow] = useState(Date.now());

    const [since, update_in] = getTimeSince(time, now, short ? short_time_since_intervals : time_since_intervals);
    const update_at = Date.now() + update_in;

    useEffect(() => {
        const timeout = setTimeout(() => setNow(Date.now()), Math.max(1000, update_at - Date.now()));
        return () => clearTimeout(timeout);
    }, [time, short, update_at]);

    return since;
}

interface TimeSinceInterval {
    interval: number;
    max: number;
    string: (count: number) => string;
}

const time_since_intervals: TimeSinceInterval[] = [
    {interval: 1000, max: 10, string: () => 'just now'},
    {interval: 1000, max: 60, string: c => c + ' second' + (c === 1 ? '' : 's') + ' ago'},
    {interval: 60 * 1000, max: 60, string: c => c + ' minute' + (c === 1 ? '' : 's') + ' ago'},
    {interval: 60 * 60 * 1000, max: 24, string: c => c + ' hour' + (c === 1 ? '' : 's') + ' ago'},
    {interval: 24 * 60 * 60 * 1000, max: Infinity, string: c => c + ' day' + (c === 1 ? '' : 's') + ' ago'},
];
const short_time_since_intervals: TimeSinceInterval[] = [
    {interval: 1000, max: 10, string: () => 'Just now'},
    {interval: 1000, max: 60, string: c => c + ' sec' + (c === 1 ? '' : 's')},
    {interval: 60 * 1000, max: 60, string: c => c + ' min' + (c === 1 ? '' : 's')},
    {interval: 60 * 60 * 1000, max: 24, string: c => c + ' hr' + (c === 1 ? '' : 's')},
    {interval: 24 * 60 * 60 * 1000, max: Infinity, string: c => c + ' day' + (c === 1 ? '' : 's')},
];

function getTimeSince(time: Date | number, now = Date.now(), intervals = time_since_intervals): [string, number] {
    if (time instanceof Date) time = time.getTime();

    const elapsed = Math.max(0, now - time);
    const last = intervals[time_since_intervals.length - 1];

    for (const i of intervals) {
        if (elapsed < i.max * i.interval || last === i) {
            const count = Math.floor(elapsed / i.interval);
            return [i.string.call(null, count), i.interval - (elapsed - (count * i.interval))];
        }
    }

    throw new Error('Invalid intervals');
}
