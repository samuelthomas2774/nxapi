import React, { useCallback } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { NintendoAccountUser } from '../../api/na.js';
import { SavedMoonToken, SavedToken } from '../../util.js';
import ipc from './ipc.js';
import { useAsync } from './util.js';

async function getAccounts() {
    const ids = await ipc.listNintendoAccounts();

    const accounts: {
        user: NintendoAccountUser;
        nso: SavedToken | null;
        moon: SavedMoonToken | null;
    }[] = [];

    for (const id of ids ?? []) {
        const nsotoken = await ipc.getNintendoAccountNsoToken(id);
        const moontoken = await ipc.getNintendoAccountMoonToken(id);

        const nso = nsotoken ? await ipc.getSavedNsoToken(nsotoken) ?? null : null;
        const moon = moontoken ? await ipc.getSavedMoonToken(moontoken) ?? null : null;

        if (!nso && !moon) continue;

        accounts.push({user: nso?.user ?? moon!.user, nso, moon});
    }

    return accounts;
}

function App() {
    const theme = useColorScheme() === 'light' ? light : dark;

    const [users] = useAsync(useCallback(() => getAccounts(), [ipc]));

    console.log(users);

    return <View style={styles.app}>
        <Text>Hello from React!</Text>

        {users?.map(u => <Text key={u.user.id} style={theme.text}>
            {u.user.id} - {u.user.nickname}
        </Text>)}
    </View>;
}

const styles = StyleSheet.create({
    app: {
    },
});

const light = StyleSheet.create({
    text: {
        color: '#212121',
    },
});

const dark = StyleSheet.create({
    text: {
        color: '#f5f5f5',
    },
});

export default App;
