import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { User } from 'discord-rpc';
import ipc, { events } from '../ipc.js';
import { RequestState, useAsync, useEventListener } from '../util.js';
import { DiscordPresenceSource, DiscordPresenceSourceUrl, DiscordPresenceSourceCoral, DiscordStatus } from '../../common/types.js';
import { DiscordPresence } from '../../../discord/types.js';
import { DISCORD_COLOUR, TEXT_COLOUR_DARK } from '../constants.js';
import Warning from '../components/icons/warning.js';

export default function DiscordPresenceSource(props: {
    source: DiscordPresenceSource | null;
    presence: DiscordPresence | null;
    user: User | null;
}) {
    const [status, setStatus] = useState<DiscordStatus | null>(null);

    useEffect(() => {
        ipc.getDiscordStatus().then(setStatus);
    }, [ipc]);

    useEventListener(events, 'update-discord-status', setStatus, []);

    const showErrorDetails = useCallback(() => {
        ipc.showDiscordLastUpdateError();
    }, [ipc]);

    if (!props.source) return null;

    return <TouchableOpacity onPress={() => ipc.showDiscordModal()}>
        <View style={[styles.discord, !props.source ? styles.discordInactive : null]}>
            {renderDiscordPresenceSource(props.source)}
            {props.presence || props.user ? <DiscordPresence presence={props.presence} user={props.user} /> : null}

            {status?.error_message ?
                <DiscordPresenceError message={status?.error_message} onPress={showErrorDetails} /> : null}
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
            Discord Rich Presence active:{' '}
            <Image source={{uri: friend.imageUri, width: 16, height: 16}} style={styles.discordNsoUserImage} />{' '}
            {friend.name}
        </Text> : <Text style={styles.discordSourceText}>
            Discord Rich Presence active
        </Text>}
    </View>;
}

function DiscordPresenceSourceUrl(props: {
    source: DiscordPresenceSourceUrl;
}) {
    return <View style={styles.discordSource}>
        <Text style={styles.discordSourceText} numberOfLines={3} ellipsizeMode="tail">
            Discord Rich Presence active:{' '}
            <Text style={styles.discordSourceUrlValue}>{props.source.url}</Text>
        </Text>
    </View>;
}

function DiscordPresenceInactive() {
    return <View style={styles.discordSource}>
        <Text style={styles.discordSourceText}>Discord Rich Presence not active</Text>
    </View>;
}

function DiscordPresence(props: {
    presence: DiscordPresence | null;
    user: User | null;
}) {
    const large_image_url = props.presence ? props.presence.activity.largeImageKey?.match(/^\d{16}$/) ?
        'https://cdn.discordapp.com/app-assets/' + props.presence.id + '/' +
            props.presence.activity.largeImageKey + '.png' :
        props.presence.activity.largeImageKey : undefined;

    const user_image_url = props.user ?
        props.user.avatar ? 'https://cdn.discordapp.com/avatars/' + props.user.id + '/' + props.user.avatar + '.png' :
        !props.user.discriminator || props.user.discriminator === '0' ?
            'https://cdn.discordapp.com/embed/avatars/' + ((parseInt(props.user.id) >> 22) % 6) + '.png' :
        'https://cdn.discordapp.com/embed/avatars/' + (parseInt(props.user.discriminator) % 5) + '.png' : undefined;

    return <View style={styles.discordPresenceContainer}>
        {props.presence ? <View style={styles.discordPresence}>
            <Image source={{uri: large_image_url, width: 18, height: 18}} style={styles.discordPresenceImage} />
            <Text style={styles.discordPresenceText} numberOfLines={1} ellipsizeMode="tail">Playing</Text>
        </View> : null}

        {props.user ? <View style={styles.discordUser}>
            <Image source={{uri: user_image_url, width: 18, height: 18}} style={styles.discordUserImage} />
            <Text style={styles.discordUserText} numberOfLines={1} ellipsizeMode="tail">
                {props.user.username}
                {props.user.discriminator && props.user.discriminator !== '0' ?
                    <Text style={styles.discordUserDiscriminator}>#{props.user.discriminator}</Text> : null}
            </Text>
        </View> : <View style={styles.discordUser}>
            <Text style={styles.discordUserText} numberOfLines={1} ellipsizeMode="tail">Not connected to Discord</Text>
        </View>}
    </View>;
}

function DiscordPresenceError(props: {
    message: string;
    onPress?: () => void;
}) {
    return <TouchableOpacity onPress={props.onPress} style={styles.errorTouchable}>
        <View style={styles.error}>
            <Text style={styles.icon}><Warning /></Text>
            <Text style={styles.errorText} numberOfLines={1} ellipsizeMode="tail">{props.message}</Text>
        </View>
    </TouchableOpacity>;
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
    discordNsoUserImage: {
        borderRadius: 8,
        textAlignVertical: -3,
    },
    discordSourceUrlValue: {
        fontFamily: 'monospace',
        fontSize: 12,
        userSelect: 'all',
    },

    discordPresenceContainer: {
        marginTop: 2,
    },

    discordPresence: {
        marginTop: 10,
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
    discordUserDiscriminator: {
        opacity: 0.7,
    },

    errorTouchable: {
        marginVertical: -16,
        marginHorizontal: -20,
        marginTop: 6,
        paddingVertical: 16,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    error: {
        flexDirection: 'row',
    },
    icon: {
        marginRight: 10,
        color: TEXT_COLOUR_DARK,
    },
    errorText: {
        color: TEXT_COLOUR_DARK,
    },
});
