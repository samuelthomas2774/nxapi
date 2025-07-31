import React, { useCallback } from 'react';
import { Image, ImageStyle, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import ipc from '../ipc.js';
import { useAccentColour, useColourScheme, User, useTimeSince } from '../util.js';
import { Friend_4, Presence, PresenceState } from '../../../api/coral-types.js';
import { TEXT_COLOUR_ACTIVE, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section, { HEADER_SIZE } from './section.js';
import AddOutline from '../components/icons/add-outline.js';
import { FriendCode } from '../components/index.js';

export default function Friends(props: {
    user: User<true>;
    friends: Friend_4[];
    loading?: boolean;
    error?: Error;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'friends_section' });

    const showAddFriendModal = useCallback(() => {
        ipc.showAddFriendModal({user: props.user.user.id});
    }, [props.user.user.id]);

    const header_buttons = <TouchableOpacity onPress={showAddFriendModal} style={styles.iconTouchable}>
        <Text style={[styles.icon, {color: '#' + accent_colour}]}><AddOutline title={t('add')!} /></Text>
    </TouchableOpacity>;

    return <Section title={t('title')} loading={props.loading} error={props.error}
        errorKey={[props.user.nsotoken, 'friends']}
        headerButtons={header_buttons}
    >
        {props.friends.length ? <ScrollView horizontal>
            <View style={styles.content}>
                {props.friends.map(f => <Friend key={f.nsaId} friend={f} user={props.user} />)}
            </View>
        </ScrollView> : <View style={styles.noFriends}>
            <Text style={[styles.noFriendsText, theme.text]}>{t('no_friends')}</Text>
            <Text style={[styles.noFriendsText, styles.noFriendsFriendCodeText, theme.text]}>
                <Trans i18nKey="main_window:friends_section.friend_code">
                    <FriendCode friendcode={props.user.nso!.nsoAccount.user.links.friendCode} />
                </Trans>
            </Text>
        </View>}

        {props.friends.length ? <View style={styles.footer}>
            <Text style={[styles.friendCode, theme.text]}>
                <Trans i18nKey="main_window:friends_section.friend_code">
                    <FriendCode friendcode={props.user.nso!.nsoAccount.user.links.friendCode} />
                </Trans>
            </Text>
        </View> : null}
    </Section>;
}

function Friend(props: {
    friend: Friend_4;
    user?: User<true>;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const onPress = useCallback(() => {
        ipc.showFriendModal({
            user: props.user!.user.id,
            friend: props.friend.nsaId,
        });
    }, [ipc, props.user?.user.id, props.friend.nsaId]);
    const onContextMenu = useCallback(() => {
        ipc.showFriendMenu(props.user!.user, props.user!.nso!.nsoAccount.user, props.friend);
    }, [ipc, props.user?.user, props.user?.nso?.nsoAccount.user, props.friend]);

    const game = 'name' in props.friend.presence.game ? props.friend.presence.game : null;

    const content = <View style={styles.friend}>
        <Image source={{uri: props.friend.image2Uri, width: 50, height: 50}} style={styles.friendImage as ImageStyle} />
        {game ? <Image source={{uri: game.imageUri, width: 20, height: 20}} style={styles.presenceImage as ImageStyle} /> : null}

        <Text style={theme.text}>{props.friend.name}</Text>
        {props.friend.presence.updatedAt ? <FriendPresence presence={props.friend.presence} /> : null}
    </View>;

    const touchable = props.user ? <TouchableOpacity onPress={onPress}>
        {content}
    </TouchableOpacity> : content;

    const contextmenu = Platform.OS === 'web' && props.user ? <View
        // @ts-expect-error react-native-web
        onContextMenu={onContextMenu}
    >{touchable}</View> : touchable;

    return <View style={styles.friendContainer}>
        {contextmenu}
    </View>;
}

function FriendPresence(props: {
    presence: Presence;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'friends_section' });

    const logout = props.presence.logoutAt ? new Date(props.presence.logoutAt * 1000) : null;
    const since_logout = useTimeSince(logout ?? new Date(0), true, i18n.getFixedT(null, 'time_since'));

    if (props.presence.state === PresenceState.ONLINE || props.presence.state === PresenceState.PLAYING) {
        return <Text style={[styles.presenceText, theme.text, styles.presenceTextOnline]}>{t('presence_playing')}</Text>;
    }

    return <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>{logout ? since_logout : t('presence_offline')}</Text>;
}

const styles = StyleSheet.create({
    iconTouchable: {
        marginLeft: 10,
    },
    icon: {
        fontSize: HEADER_SIZE,
    },

    footer: {
        paddingBottom: 16,
        paddingHorizontal: ipc.platform === 'win32' ? 24 : 20,
    },
    friendCode: {
        fontSize: 12,
        opacity: 0.7,
    },
    content: {
        paddingBottom: 16,
        paddingLeft: ipc.platform === 'win32' ? 24 : 20,
        paddingRight: ipc.platform === 'win32' ? 4 : 0,
        flexDirection: 'row',
    },

    noFriends: {
        paddingVertical: 32,
        marginBottom: 20,
    },
    noFriendsText: {
        textAlign: 'center',
    },
    noFriendsFriendCodeText: {
        marginTop: 10,
    },

    friendContainer: {
        marginRight: 20,
    },
    friend: {
        minWidth: 55,
        maxWidth: 80,
        alignItems: 'center',
    },
    friendImage: {
        borderRadius: 25,
        marginBottom: 12,
    },

    presenceImage: {
        position: 'absolute',
        marginTop: 32,
        marginLeft: 32,
        borderRadius: 2,
    },

    presenceText: {
        marginTop: 5,
        fontSize: 12,
        textAlign: 'center',
    },
    presenceTextOnline: {
        color: TEXT_COLOUR_ACTIVE,
    },
    presenceTextOffline: {
        opacity: 0.7,
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
