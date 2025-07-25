import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'main_section' });

    const [announcements, announcements_error, announcements_state] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getCoralAnnouncements(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [friends, friends_error, friends_state, forceRefreshFriends] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getNsoFriends(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [webservices, webservices_error, webservices_state, forceRefreshWebServices] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getWebServices(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));
    const [active_event, active_event_error, active_event_state, forceRefreshActiveEvent] = useAsync(useCallback(() => props.user.nsotoken ?
        ipc.getCoralActiveEvent(props.user.nsotoken) : Promise.resolve(null), [ipc, props.user.nsotoken]));

    const [last_refresh_at, setLastRefreshAt] = useState(() => Date.now());

    const loading = announcements_state === RequestState.LOADING ||
        friends_state === RequestState.LOADING ||
        webservices_state === RequestState.LOADING ||
        active_event_state === RequestState.LOADING;

    const refresh = useCallback(() => Promise.all([
        setLastRefreshAt(Date.now()),
        forceRefreshFriends(), forceRefreshWebServices(), forceRefreshActiveEvent(),
    ]), [forceRefreshFriends, forceRefreshWebServices, forceRefreshActiveEvent]);

    useEffect(() => {
        if (loading || !props.autoRefresh) return;
        const timeout = setTimeout(refresh, props.autoRefresh);
        return () => clearTimeout(timeout);
    }, [ipc, props.user.nsotoken, loading, props.autoRefresh]);

    useEffect(() => {
        if (loading || !props.autoRefresh) return;

        // When enabling auto refresh, update now if we haven't updated within the interval
        if (last_refresh_at + props.autoRefresh < Date.now()) refresh();
    }, [ipc, props.autoRefresh]);

    useEventListener(events, 'window:refresh', refresh, []);

    const showErrorDetails = useCallback(() => {
        ipc.showCoralErrors(props.user.nsotoken!, ['friends', 'webservices', 'activeevent']);
    }, [friends_error, webservices_error, active_event_error]);

    if (!friends || !webservices || !active_event) {
        if (loading) {
            return <View style={styles.loading}>
                <ActivityIndicator size="large" color={'#' + accent_colour} />
            </View>;
        }

        if (friends_error || webservices_error || active_event_error) {
            const errors = [];
            if (friends_error) errors.push(t('error.message_friends'));
            if (webservices_error) errors.push(t('error.message_webservices'));
            if (active_event_error) errors.push(t('error.message_event'));

            return <View style={styles.error}>
                <Text style={[styles.errorHeader, theme.text]}>{t('error.title')}</Text>
                <Text style={[styles.errorMessage, theme.text]}>{t('error.message', {errors})}</Text>
                <View style={styles.errorActions}>
                    <Button title={t('error.retry')} onPress={refresh} color={'#' + accent_colour} primary />
                    <TouchableOpacity onPress={showErrorDetails} style={styles.errorViewDetailsTouchable}>
                        <Text style={theme.text}>{t('error.view_details')}</Text>
                    </TouchableOpacity>
                </View>
            </View>;
        }
    }

    return <View>
        {!props.user.nso && props.user.moon ? <MoonOnlyUser /> : null}

        {props.user.nso ? <SetupDiscordPresence user={props.user} friends={friends} /> : null}
        {props.user.nso && friends ? <Friends user={props.user} friends={friends}
            loading={friends_state === RequestState.LOADING} error={friends_error ?? undefined} /> : null}
        {props.user.nso && webservices ? <WebServices user={props.user} webservices={webservices}
            loading={webservices_state === RequestState.LOADING} error={webservices_error ?? undefined} /> : null}
        {props.user.nso && active_event && 'id' in active_event ? <Event user={props.user} event={active_event}
            loading={active_event_state === RequestState.LOADING} error={active_event_error ?? undefined} /> : null}
    </View>;
}

function MoonOnlyUser() {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'main_section.moon_only_user' });

    return <Section title={t('title')}>
        <View style={styles.moonOnlyUser}>
            <Text style={[styles.moonOnlyUserText, theme.text]}>{t('desc_1')}</Text>
            <Text style={[styles.moonOnlyUserText, theme.text]}>{t('desc_2')}</Text>

            <View style={styles.moonOnlyUserButton}>
                <Button title={t('login')} onPress={() => ipc.addCoralAccount()} color={'#' + accent_colour} primary />
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

    error: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    errorHeader: {
        marginBottom: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    errorMessage: {
        marginBottom: 16,
        textAlign: 'center',
    },
    errorActions: {
        alignItems: 'center',
    },
    errorViewDetailsTouchable: {
        marginTop: 10,
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
