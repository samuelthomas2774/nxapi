import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ipc from '../ipc.js';
import { useAccentColour, useEventListener } from '../util.js';
import type { StatusUpdate } from '../../../common/status.js';
import { BORDER_COLOUR_SECONDARY_DARK, TEXT_COLOUR_DARK, UPDATE_COLOUR } from '../constants.js';
import { Button } from '../components/index.js';

enum StatusUpdateFlag {
    HIDDEN = 0,
}

export default function StatusUpdates() {
    const accent_colour = useAccentColour();

    const [status_updates, setStatusUpdateData] = useState<StatusUpdate[] | null>(null);
    useEffect(() => (ipc.getStatusUpdateData().then(setStatusUpdateData), undefined), [ipc]);
    useEventListener(ipc.events, 'status-updates', setStatusUpdateData, [ipc.events]);

    return status_updates?.map(status_update => status_update.flags & (1 << StatusUpdateFlag.HIDDEN) ? null : <View style={[styles.container, status_update.colour ? {backgroundColor: status_update.colour} : null]}>
        <Text style={styles.updateText}>{status_update.content}</Text>
        {status_update.action ? <View style={styles.updateButton}>
            <Button title={status_update.action.label}
                onPress={() => ipc.openExternalUrl(status_update.action!.url)}
                color={'#' + accent_colour} />
        </View> : null}
    </View>);
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: UPDATE_COLOUR,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOUR_SECONDARY_DARK,
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
