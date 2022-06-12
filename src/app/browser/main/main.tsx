import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import ipc, { events } from '../ipc.js';
import { RequestState, useAccentColour, useAsync, useColourScheme, useEventListener, User } from '../util.js';
import Friends from './friends.js';
import WebServices from './webservices.js';
import Event from './event.js';
import Section from './section.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import SetupDiscordPresence from './discord-setup.js';
import { Button } from '../components/index.js';

export default function Main(props: {
    user: User;
    autoRefresh?: number;
}) {
    const accent_colour = useAccentColour();

    const [announcements, , announcements_state] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getNsoAnnouncements(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getNsoFriends(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [webservices, , webservices_state, forceRefreshWebServices] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getNsoWebServices(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [active_event, , active_event_state, forceRefreshActiveEvent] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getNsoActiveEvent(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));

    const loading = announcements_state === RequestState.LOADING ||
        friends_state === RequestState.LOADING ||
        webservices_state === RequestState.LOADING ||
        active_event_state === RequestState.LOADING;
    const refresh = useCallback(() => Promise.all([
        forceRefreshFriends(), forceRefreshWebServices(), forceRefreshActiveEvent(),
    ]), [forceRefreshFriends, forceRefreshWebServices, forceRefreshActiveEvent]);

    useEffect(() => {
        if (loading || !props.autoRefresh) return;
        const timeout = setTimeout(refresh, props.autoRefresh);
        return () => clearTimeout(timeout);
    }, [ipc, props.user.nsotoken, loading, props.autoRefresh]);

    useEventListener(events, 'window:refresh', refresh, []);

    if (loading && (!announcements || !friends || !webservices || !active_event)) {
        return <View style={styles.loading}>
            <ActivityIndicator size="large" color={'#' + accent_colour} />
        </View>;
    }

    return <View>
        {!props.user.nso && props.user.moon ? <MoonOnlyUser /> : null}

        {props.user.nso ? <SetupDiscordPresence user={props.user} friends={friends} /> : null}
        {props.user.nso && friends ? <Friends user={props.user} friends={friends}
            loading={friends_state === RequestState.LOADING} /> : null}
        {props.user.nso && webservices ? <WebServices user={props.user} webservices={webservices}
            loading={webservices_state === RequestState.LOADING} /> : null}
        {props.user.nso && active_event && 'id' in active_event ? <Event user={props.user} event={active_event}
            loading={active_event_state === RequestState.LOADING} /> : null}
    </View>;
}

function MoonOnlyUser() {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();

    return <Section title="Nintendo Switch Online">
        <View style={styles.moonOnlyUser}>
            <Text style={[styles.moonOnlyUserText, theme.text]}>This user is signed in to the Nintendo Switch Parental Controls app, but not the Nintendo Switch Online app.</Text>
            <Text style={[styles.moonOnlyUserText, theme.text]}>Login to the Nintendo Switch Online app to view details here, or use the nxapi command to access Parental Controls data.</Text>

            <View style={styles.moonOnlyUserButton}>
                <Button title="Login" onPress={() => ipc.addNsoAccount()} color={'#' + accent_colour} primary />
            </View>
        </View>
    </Section>;
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },

    container: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },

    moonOnlyUser: {
        paddingVertical: 32,
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    moonOnlyUserText: {
        marginBottom: 10,
        textAlign: 'center',
    },
    moonOnlyUserButton: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'center',
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
