import React, { useCallback, useMemo } from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, useAccentColour, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener, User } from '../util.js';
import { Friend, PresencePermissions } from '../../../api/znc-types.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';

export default function SetupDiscordPresence(props: {
    user: User;
    friends: Friend[] | null;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();

    const [source, discord_presence_source_state] = useDiscordPresenceSource();

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);

    const added_friends = useMemo(() => users?.filter(u => u.nso && props.friends?.find(f => {
        if (f.nsaId !== u.nso?.nsoAccount.user.nsaId) return false;

        return props.user.nso!.nsoAccount.user.permissions.presence === PresencePermissions.FRIENDS ||
            (props.user.nso!.nsoAccount.user.permissions.presence === PresencePermissions.FAVORITE_FRIENDS &&
                f.isFavoriteFriend);
    })), [users, props.friends]);

    const auth_user = source && 'na_id' in source ? users?.find(u => u.user.id === source.na_id)?.nso : null;
    const friend = source && 'na_id' in source && source.na_id === props.user.user.id && source.friend_nsa_id ?
        props.friends?.find(f => f.nsaId === source.friend_nsa_id) : null;

    if (!props.friends || discord_presence_source_state !== RequestState.LOADED || !users) return null;

    const content = !source && added_friends?.length ? <>
        <Text style={[styles.text, theme.text]}>
            Use one of these accounts to set up Discord Rich Presence for this user:{' '}
            {added_friends.map((u, i) => <React.Fragment key={u.user.id}>
                {i === 0 ? '' : ', '}
                <Image source={{uri: u.nso!.nsoAccount.user.imageUri, width: 16, height: 16}} style={styles.discordNsoUserImage} />{' '}
                {u.nso!.nsoAccount.user.name}
                {u.nso!.nsoAccount.user.name !== u.user.nickname ? ' (' + u.user.nickname + ')' : ''}
            </React.Fragment>)}.
        </Text>
    </> :!source && users ? <>
        <Text style={[styles.text, theme.text]}>Add a Nintendo Switch Online account with this user as a friend to set up Discord Rich Presence.</Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && !source.friend_nsa_id ? <>
        <Text style={[styles.text, theme.text]}>
            This user's presence is being shared to Discord.
        </Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && friend ? <>
        <Text style={[styles.text, theme.text]}>
            <Image source={{uri: friend.imageUri, width: 16, height: 16}} style={styles.discordNsoUserImage} />{' '}
            {friend.name}'s presence is being shared to Discord using this account.
        </Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && source.friend_nsa_id ? <>
        <Text style={[styles.text, theme.text]}>
            An unknown user's presence is being shared to Discord using this account.
        </Text>
    </> : source && 'na_id' in source && auth_user && source.friend_nsa_id && source.friend_nsa_id === props.user.nso?.nsoAccount.user.nsaId ? <>
        <Text style={[styles.text, theme.text]}>
            This user's presence is being shared to Discord using{' '}
            <Image source={{uri: auth_user.nsoAccount.user.imageUri, width: 16, height: 16}} style={styles.discordNsoUserImage} />{' '}
            {auth_user.nsoAccount.user.name}
            {auth_user.nsoAccount.user.name !== auth_user.user.nickname ? ' (' + auth_user.user.nickname + ')' : ''}.
        </Text>
    </> : null;

    return content ? <Section title="Discord Rich Presence">
        <View style={styles.content}>
            {content}

            {source ? <View style={styles.button}>
                <Button title="Disable" onPress={() => ipc.setDiscordPresenceSource(null)} color={'#' + accent_colour} />
            </View> : null}
        </View>
    </Section> : null;
}

const styles = StyleSheet.create({
    content: {
        marginTop: -4,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },

    text: {
        fontSize: 13,
        opacity: 0.7,
    },
    discordNsoUserImage: {
        borderRadius: 8,
        textAlignVertical: -3,
    },

    button: {
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
