import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ipc from '../ipc.js';
import { useAccentColour, useEventListener } from '../util.js';
import type { UpdateCacheData } from '../../../common/update.js';
import type { StatusUpdate } from '../../../common/status.js';
import { BORDER_COLOUR_SECONDARY_DARK, TEXT_COLOUR_DARK, UPDATE_COLOUR } from '../constants.js';
import { Button } from '../components/index.js';

enum StatusUpdateFlag {
    SUPPRESS_UPDATE_BANNER = 1,
}

export default function Update() {
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'update' });

    const [update, setUpdateData] = useState<UpdateCacheData | null>(null);
    useEffect(() => (ipc.getUpdateData().then(setUpdateData), undefined), [ipc]);
    useEventListener(ipc.events, 'nxapi:update:latest', setUpdateData, [ipc.events]);

    const [status_updates, setStatusUpdateData] = useState<StatusUpdate[] | null>(null);
    useEffect(() => (ipc.getStatusUpdateData().then(setStatusUpdateData), undefined), [ipc]);
    useEventListener(ipc.events, 'status-updates', setStatusUpdateData, [ipc.events]);

    const status_update_suppress_update_banner = useMemo(() =>
        status_updates?.find(s => s.flags & (1 << StatusUpdateFlag.SUPPRESS_UPDATE_BANNER)),
        [status_updates]);

    return update && 'update_available' in update && update.update_available && !status_update_suppress_update_banner ? <View style={styles.container}>
        <Text style={styles.updateText}>{t('update_available', {name: update.latest.name})}</Text>
        <View style={styles.updateButton}>
            <Button title={t('download')}
                onPress={() => ipc.openExternalUrl(update.latest.html_url)}
                color={'#' + accent_colour} />
        </View>
    </View> : update && 'error_message' in update ? <View style={styles.container}>
        <Text style={styles.updateText}>{t('error', {message: update.error_message})}</Text>
        <View style={styles.updateButton}>
            <Button title={t('retry')}
                onPress={() => (setUpdateData(null), ipc.checkUpdates())}
                color={'#' + accent_colour} />
        </View>
    </View> : null;
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
