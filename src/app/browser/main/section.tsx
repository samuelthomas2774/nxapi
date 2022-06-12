import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAccentColour, useColourScheme } from '../util.js';
import { BORDER_COLOUR_LIGHT, BORDER_COLOUR_SECONDARY_DARK, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc from '../ipc.js';

export default function Section(props: React.PropsWithChildren<{
    title: string;
    loading?: boolean;
}>) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();

    return <View style={[styles.container, theme.container]}>
        <View style={styles.header}>
            <Text style={[styles.headerText, theme.text]}>{props.title}</Text>
            {props.loading ? <ActivityIndicator style={styles.activityIndicator} size={14}
                color={'#' + accent_colour} /> : null}
        </View>

        {props.children}
    </View>;
}

const styles = StyleSheet.create({
    container: {
        marginBottom: ipc.platform === 'win32' ? 10 : 0,
        borderBottomWidth: ipc.platform === 'win32' ? 0 : 1,
    },
    header: {
        paddingVertical: ipc.platform === 'win32' ? 20 : 16,
        paddingHorizontal: ipc.platform === 'win32' ? 24 : 20,
        flexDirection: 'row',
    },
    headerText: {
        flex: 1,
        fontSize: ipc.platform === 'win32' ? 24 : 14,
    },
    activityIndicator: {
        marginLeft: 10,
    },
});

const light = StyleSheet.create({
    container: {
        borderBottomColor: BORDER_COLOUR_LIGHT,
    },
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    container: {
        borderBottomColor: BORDER_COLOUR_SECONDARY_DARK,
    },
    text: {
        color: TEXT_COLOUR_DARK,
    },
});
