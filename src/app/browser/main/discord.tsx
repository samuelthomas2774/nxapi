import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { User } from 'discord-rpc';
import ipc, { events } from '../ipc.js';
import { RequestState, useAsync, useEventListener } from '../util.js';
import { DiscordPresenceSource, DiscordPresenceSourceUrl, DiscordPresenceSourceCoral } from '../../common/types.js';
import { DiscordPresence } from '../../../discord/types.js';
import { DISCORD_COLOUR, TEXT_COLOUR_DARK } from '../constants.js';
import { NintendoSwitchUser } from '../components/index.js';

export default function DiscordPresenceSource(props: {
    source: DiscordPresenceSource | null;
    presence: DiscordPresence | null;
    user: User | null;
}) {
    if (!props.source) return null;

    return <TouchableOpacity onPress={() => ipc.showDiscordModal()}>
        <View style={[styles.discord, !props.source ? styles.discordInactive : null]}>
            {renderDiscordPresenceSource(props.source)}
            {props.presence && props.user ? <DiscordPresence presence={props.presence} user={props.user} /> : null}
        </View>
    </TouchableOpacity>;
}

function renderDiscordPresenceSource(source: DiscordPresenceSource | null) {
    if (source && 'na_id' in source) {
        return <DiscordPresenceSourceCoral source={source} />;
    } else if (source && 'url' in source) {
        return <DiscordPresenceSourceUrl source={source} />;
    } else {
        return <DiscordPresenceInactive />;
    }
}

function DiscordPresenceSourceCoral(props: {
    source: DiscordPresenceSourceCoral;
}) {
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'sidebar' });

    const [token] = useAsync(useCallback(() =>
        ipc.getNintendoAccountCoralToken(props.source.na_id), [ipc, props.source.na_id]));
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => token ?
        ipc.getNsoFriends(token) : Promise.resolve(null), [ipc, token]));
    const friend = friends?.find(f => f.nsaId === props.source.friend_nsa_id);

    useEffect(() => {
        if (friends_state !== RequestState.LOADED) return;
        const timeout = setTimeout(forceRefreshFriends, 60 * 1000);
        return () => clearTimeout(timeout);
    }, [ipc, token, friends_state]);

    useEventListener(events, 'window:refresh', forceRefreshFriends, []);

    return <View style={styles.discordSource}>
        {friend ? <Text style={styles.discordSourceText}>
            <Trans i18nKey="main_window:sidebar.discord_active_friend">
                <NintendoSwitchUser friend={friend} />
            </Trans>
        </Text> : <Text style={styles.discordSourceText}>
            {t('discord_active')}
        </Text>}
    </View>;
}

function DiscordPresenceSourceUrl(props: {
    source: DiscordPresenceSourceUrl;
}) {
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'sidebar' });

    return <View style={styles.discordSource}>
        <Text style={styles.discordSourceText} numberOfLines={3} ellipsizeMode="tail">
            {t('discord_active')}:{' '}
            <Text style={styles.discordSourceUrlValue}>{props.source.url}</Text>
        </Text>
    </View>;
}

function DiscordPresenceInactive() {
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'sidebar' });

    return <View style={styles.discordSource}>
        <Text style={styles.discordSourceText}>{t('discord_not_active')}</Text>
    </View>;
}

function DiscordPresence(props: {
    presence: DiscordPresence;
    user: User;
}) {
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'sidebar' });

    const large_image_url = props.presence.activity.largeImageKey?.match(/^\d{16}$/) ?
        'https://cdn.discordapp.com/app-assets/' + props.presence.id + '/' +
            props.presence.activity.largeImageKey + '.png' :
        props.presence.activity.largeImageKey;
    const user_image_url = 'https://cdn.discordapp.com/avatars/' + props.user.id + '/' + props.user.avatar + '.png';

    return <>
        <View style={styles.discordPresence}>
            <Image source={{uri: large_image_url, width: 18, height: 18}} style={styles.discordPresenceImage} />
            <Text style={styles.discordPresenceText} numberOfLines={1} ellipsizeMode="tail">{t('discord_playing')}</Text>
        </View>

        <View style={styles.discordUser}>
            <Image source={{uri: user_image_url, width: 18, height: 18}} style={styles.discordUserImage} />
            <Text style={styles.discordUserText} numberOfLines={1} ellipsizeMode="tail">{props.user.username}#{props.user.discriminator}</Text>
        </View>
    </>;
}

const styles = StyleSheet.create({
    discord: {
        backgroundColor: DISCORD_COLOUR,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    discordInactive: {
        opacity: 0.7,
    },

    discordSource: {
    },
    discordSourceText: {
        color: TEXT_COLOUR_DARK,
    },
    discordSourceUrlValue: {
        fontFamily: 'monospace',
        fontSize: 12,
        userSelect: 'all',
    },

    discordPresence: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discordPresenceImage: {
        marginRight: 10,
        borderRadius: 2,
    },
    discordPresenceText: {
        color: TEXT_COLOUR_DARK,
    },

    discordUser: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discordUserImage: {
        marginRight: 10,
        borderRadius: 9,
    },
    discordUserText: {
        color: TEXT_COLOUR_DARK,
    },
});
