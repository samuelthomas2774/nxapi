import React from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import ipc from '../ipc.js';
import { useAccentColour, useColourScheme } from '../util.js';
import { User } from '../app.js';
import { ActiveEvent } from '../../../api/znc-types.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';

export default function Event(props: {
    user: User;
    event: ActiveEvent;
    loading?: boolean;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();

    const event_members = props.event.members.filter(m => m.isPlaying).length;
    const voip_members = props.event.members.filter(m => m.isJoinedVoip).length;

    return <Section title="Voice chat" loading={props.loading}>
        <View style={styles.content}>
            <Image source={{uri: props.event.imageUri, width: 100, height: 100}} style={styles.image} />

            <View style={styles.detail}>
                <Text style={[styles.eventName, theme.text]}>{props.event.name}</Text>
                <Text style={[styles.eventMembers, theme.text]}>
                    {event_members} in game, {voip_members} in voice chat
                    {props.event.members.length > 1 ? ' of ' + props.event.members.length + ' members' : ''}
                </Text>

                <Text style={[styles.eventInstruction, theme.text]}>
                    Use the Nintendo Switch Online app on iOS or Android to {voip_members ? 'join' : 'start'} voice chat.
                </Text>

                {props.event.shareUri ? <View style={styles.shareButton}>
                    <Button title="Share" onPress={() => ipc.share({urls: [props.event.shareUri]})}
                        color={'#' + accent_colour} />
                </View> : null}
            </View>
        </View>
    </Section>;
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
    },
    image: {
        marginRight: 20,
        borderRadius: 2,
    },
    detail: {
        flex: 1,
    },
    eventName: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 5,
    },
    eventMembers: {
        marginBottom: 5,
        fontSize: 13,
    },
    eventInstruction: {
        fontSize: 13,
        opacity: 0.7,
    },
    shareButton: {
        marginTop: 10,
        flexDirection: 'row',
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
