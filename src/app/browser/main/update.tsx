import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ipc from '../ipc.js';
import { useAccentColour, useEventListener } from '../util.js';
import type { UpdateCacheData } from '../../../common/update.js';
import { TEXT_COLOUR_DARK, UPDATE_COLOUR } from '../constants.js';
import { Button } from '../components/index.js';

export default function Update() {
    const accent_colour = useAccentColour();

    const [update, setUpdateData] = useState<UpdateCacheData | null>(null);
    useEffect(() => (ipc.getUpdateData().then(setUpdateData), undefined), [ipc]);
    useEventListener(ipc.events, 'nxapi:update:latest', setUpdateData, [ipc.events]);

    return update && 'update_available' in update && update.update_available ? <View style={styles.container}>
        <Text style={styles.updateText}>Update available: {update.latest.name}</Text>
        <View style={styles.updateButton}>
            <Button title="Download"
                onPress={() => ipc.openExternalUrl(update.latest.html_url)}
                color={'#' + accent_colour} />
        </View>
    </View> : update && 'error_message' in update ? <View style={styles.container}>
        <Text style={styles.updateText}>Error checking for updates: {update.error_message}</Text>
        <View style={styles.updateButton}>
            <Button title="Try again"
                onPress={() => (setUpdateData(null), ipc.checkUpdates())}
                color={'#' + accent_colour} />
        </View>
    </View> : null;
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: UPDATE_COLOUR,
        paddingVertical: 8,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    updateText: {
        marginVertical: 4,
        flex: 1,
        color: TEXT_COLOUR_DARK,
    },
    updateButton: {
        marginLeft: 14,
    },
});
