import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import type { NintendoAccountUser } from '../../api/na.js';
import type { SavedToken } from '../../common/auth/nso.js';
import type { SavedMoonToken } from '../../common/auth/moon.js';
import ipc from './ipc.js';
import { Root, useAsync } from './util.js';
import Sidebar from './main/sidebar.js';
import Update from './main/update.js';
import Main from './main/index.js';
import { BACKGROUND_COLOUR_MAIN_DARK, BACKGROUND_COLOUR_MAIN_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from './constants.js';

export interface AppProps {
    //
}

export interface User {
    user: NintendoAccountUser;
    nso: SavedToken | null;
    nsotoken: string | undefined;
    moon: SavedMoonToken | null;
    moontoken: string | undefined;
}

async function getAccounts() {
    const ids = await ipc.listNintendoAccounts();

    const accounts: User[] = [];

    for (const id of ids ?? []) {
        const nsotoken = await ipc.getNintendoAccountNsoToken(id);
        const moontoken = await ipc.getNintendoAccountMoonToken(id);

        const nso = nsotoken ? await ipc.getSavedNsoToken(nsotoken) ?? null : null;
        const moon = moontoken ? await ipc.getSavedMoonToken(moontoken) ?? null : null;

        if (!nso && !moon) continue;

        accounts.push({user: nso?.user ?? moon!.user, nso, nsotoken, moon, moontoken});
    }

    return accounts;
}

function App(props: AppProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [users] = useAsync(useCallback(() => getAccounts(), [ipc]));

    console.log(users);

    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
    const selectedUser = useMemo(() => users?.find(u => u.user.id === selectedUserId), [users, selectedUserId]);

    useEffect(() => {
        if (!selectedUser) setSelectedUserId(users?.[0]?.user.id);
    }, [users, selectedUser]);

    return <Root titleUser={selectedUser} style={styles.app}>
        <Sidebar users={users} selectedUser={selectedUserId} onSelectUser={setSelectedUserId} />

        <View style={[styles.main, theme.main]}>
            <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollerContent}>
                <Update />

                {selectedUser ? <Main key={selectedUser.user.id} user={selectedUser} /> : null}
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
    content: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
});

const light = StyleSheet.create({
    main: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_LIGHT,
    },
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    main: {
        backgroundColor: BACKGROUND_COLOUR_MAIN_DARK,
    },
    text: {
        color: TEXT_COLOUR_DARK,
    },
});

export default App;
