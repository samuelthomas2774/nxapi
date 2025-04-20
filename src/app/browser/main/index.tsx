import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import ipc, { events } from '../ipc.js';
import { getAccounts, Root, useAsync, useEventListener } from '../util.js';
import Sidebar from './sidebar.js';
import Update from './update.js';
import Main from './main.js';
import { BACKGROUND_COLOUR_MAIN_DARK, BACKGROUND_COLOUR_MAIN_LIGHT, BACKGROUND_COLOUR_SECONDARY_DARK, BACKGROUND_COLOUR_SECONDARY_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import StatusUpdates from './status-updates.js';

const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

export interface AppProps {
    vibrancy?: boolean;
    insetTitleBarControls?: boolean;
}

export default function App(props: AppProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));

    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);
    useEventListener(events, 'window:refresh', forceRefreshAccounts, []);

    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
    const selectedUser = useMemo(() => users?.find(u => u.user.id === selectedUserId), [users, selectedUserId]);

    const [focused, setFocused] = useState(ipc.getWindowFocused());
    useEventListener(events, 'window:focused', setFocused, []);

    useEffect(() => {
        if (!selectedUser) setSelectedUserId(users?.[0]?.user.id);
    }, [users, selectedUser]);

    return <Root
        titleUser={selectedUser}
        vibrancy={props.vibrancy}
        style={[styles.app, !props.vibrancy ? theme.appNoVibrancy : null]}
        i18nNamespace={['main_window', 'time_since']}
    >
        <Sidebar users={users} selectedUser={selectedUserId} onSelectUser={setSelectedUserId}
            insetTitleBarControls={props.insetTitleBarControls}
        />

        <View style={[styles.main, theme.main]}>
            <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollerContent}>
                <StatusUpdates />
                <Update />

                {selectedUser ? <Main key={selectedUser.user.id} user={selectedUser}
                    autoRefresh={focused ? REFRESH_INTERVAL : undefined} /> : null}
            </ScrollView>
        </View>
    </Root>;
}

const styles = StyleSheet.create({
    app: {
        flexDirection: 'row',
    },
    main: {
        flex: 1,
    },
    scroller: {
        flex: 1,
    },
    scrollerContent: {
        flex: 1,
    },
});

const light = StyleSheet.create({
    appNoVibrancy: {
        backgroundColor: BACKGROUND_COLOUR_SECONDARY_LIGHT,
    },
    main: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_LIGHT,
    },
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    appNoVibrancy: {
        backgroundColor: BACKGROUND_COLOUR_SECONDARY_DARK,
    },
    main: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_DARK,
    },
    text: {
        color: TEXT_COLOUR_DARK,
    },
});
