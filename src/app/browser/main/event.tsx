import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ipc from '../ipc.js';
import { useAccentColour, useColourScheme, User } from '../util.js';
import { ActiveEvent } from '../../../api/coral-types.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';
import { Button } from '../components/index.js';

export default function Event(props: {
    user: User;
    event: ActiveEvent;
    loading?: boolean;
    error?: Error;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'event_section' });

    const event_members = props.event.members.filter(m => m.isPlaying).length;
    const voip_members = props.event.members.filter(m => m.isJoinedVoip).length;

    return <Section title={t('title')} loading={props.loading} error={props.error}>
        <View style={styles.content}>
            <Image source={{uri: props.event.imageUri, width: 100, height: 100}} style={styles.image} />

            <View style={styles.detail}>
                <Text style={[styles.eventName, theme.text]}>{props.event.name}</Text>
                <Text style={[styles.eventMembers, theme.text]}>
                    {props.event.members.length > 1 ?
                        t('members_with_total', {event: event_members, voip: voip_members, total: props.event.members.length}) :
                        t('members', {event: event_members, voip: voip_members})}
                </Text>

                <Text style={[styles.eventInstruction, theme.text]}>
                    {t(voip_members ? 'app_join' : 'app_start')}
                </Text>

                {props.event.shareUri ? <View style={styles.shareButton}>
                    <Button title={t('share')} onPress={() => ipc.share({urls: [props.event.shareUri]})}
                        color={'#' + accent_colour} />
                </View> : null}
            </View>
        </View>
    </Section>;
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 16,
        paddingHorizontal: ipc.platform === 'win32' ? 24 : 20,
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
