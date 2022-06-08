import React, { useCallback } from 'react';
import { Image, ImageStyle, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ipc from '../ipc.js';
import { useColourScheme, User } from '../util.js';
import { Friend, Presence, PresenceState } from '../../../api/znc-types.js';
import { TEXT_COLOUR_ACTIVE, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';

export default function Friends(props: {
    user: User;
    friends: Friend[];
    loading?: boolean;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const onFriendCodeContextMenu = useCallback(() => {
        ipc.showFriendCodeMenu(props.user.nso!.nsoAccount.user.links.friendCode);
    }, [ipc, props.user.nso?.nsoAccount.user.links.friendCode]);

    const fc = <Text
        style={styles.friendCodeValue}
        // @ts-expect-error react-native-web
        onContextMenu={onFriendCodeContextMenu}
    >SW-{props.user.nso!.nsoAccount.user.links.friendCode.id}</Text>;

    return <Section title="Friends" loading={props.loading}>
        {props.friends.length ? <ScrollView horizontal>
            <View style={styles.content}>
                {props.friends.map(f => <Friend key={f.nsaId} friend={f} user={props.user} />)}
            </View>
        </ScrollView> : <View style={styles.noFriends}>
            <Text style={[styles.noFriendsText, theme.text]}>Add friends using a Nintendo Switch console.</Text>
            <Text style={[styles.noFriendsText, styles.noFriendsFriendCodeText, theme.text]}>Your friend code: {fc}</Text>
        </View>}

        {props.friends.length ? <View style={styles.footer}>
            <Text style={[styles.friendCode, theme.text]}>Your friend code: {fc}</Text>
        </View> : null}
    </Section>;
}

function Friend(props: {
    friend: Friend;
    user?: User;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const onContextMenu = useCallback(() => {
        ipc.showFriendMenu(props.user!.user, props.user!.nso!.nsoAccount.user, props.friend);
    }, [ipc, props.user?.user, props.user?.nso?.nsoAccount.user]);

    const game = 'name' in props.friend.presence.game ? props.friend.presence.game : null;

    const content = <View style={styles.friend}>
        <Image source={{uri: props.friend.imageUri, width: 50, height: 50}} style={styles.friendImage as ImageStyle} />
        {game ? <Image source={{uri: game.imageUri, width: 20, height: 20}} style={styles.presenceImage as ImageStyle} /> : null}

        <Text style={theme.text}>{props.friend.name}</Text>
        {props.friend.presence.updatedAt ? <FriendPresence presence={props.friend.presence} /> : null}
    </View>;

    const touchable = props.user ? <TouchableOpacity onPress={() => ipc.showFriendModal(props.user!.user.id, props.friend.nsaId)}>
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

    if (props.presence.state === PresenceState.ONLINE || props.presence.state === PresenceState.PLAYING) {
        return <Text style={[styles.presenceText, theme.text, styles.presenceTextOnline]}>Playing</Text>;
    }

    return <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>Offline</Text>;
}

const styles = StyleSheet.create({
    footer: {
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    friendCode: {
        fontSize: 12,
        opacity: 0.7,
    },
    friendCodeValue: {
        // @ts-expect-error
        userSelect: 'all',
    },
    content: {
        paddingBottom: 16,
        paddingLeft: 20,
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
