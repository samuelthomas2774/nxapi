import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ipc from '../ipc.js';
import { useColourScheme, User } from '../util.js';
import { WebService } from '../../../api/znc-types.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';

export default function WebServices(props: {
    user: User;
    webservices: WebService[];
    loading?: boolean;
}) {
    if (!props.webservices.length) return null;

    return <Section title="Game-specific services" loading={props.loading}>
        <ScrollView horizontal>
            <View style={styles.content}>
                {props.webservices.map(g => <WebService key={g.id} webservice={g} token={props.user.nsotoken} />)}
            </View>
        </ScrollView>
    </Section>;
}

function WebService(props: {
    webservice: WebService;
    token?: string;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const content = <View style={styles.webservice}>
        <Image source={{uri: props.webservice.imageUri, width: 120, height: 120}} style={styles.webserviceImage} />

        <Text style={[styles.webserviceName, theme.text]}>{props.webservice.name}</Text>
    </View>;

    return <View style={styles.webserviceContainer}>
        {props.token ? <TouchableOpacity onPress={() => ipc.openWebService(props.webservice, props.token!)}>
            {content}
        </TouchableOpacity> : content}
    </View>;
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 16,
        paddingLeft: 20,
        paddingRight: 6,
        flexDirection: 'row',
    },

    webserviceContainer: {
        marginRight: 14,
    },
    webservice: {
        maxWidth: 120,
        alignItems: 'center',
    },
    webserviceImage: {
        borderRadius: 2,
        marginBottom: 12,
    },
    webserviceName: {
        textAlign: 'center',
    },
});

const light = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_DARK,
    },
});
