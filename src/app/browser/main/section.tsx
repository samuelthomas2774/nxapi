import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAccentColour, useColourScheme } from '../util.js';
import { BORDER_COLOUR_DARK, BORDER_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';

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
        borderBottomWidth: 1,
    },
    header: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
    },
    headerText: {
        flex: 1,
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
        borderBottomColor: BORDER_COLOUR_DARK,
    },
    text: {
        color: TEXT_COLOUR_DARK,
    },
});
