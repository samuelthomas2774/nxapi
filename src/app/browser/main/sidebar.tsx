import React, { useCallback } from 'react';
import { Image, ImageURISource, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ipc from '../ipc.js';
import { RequestState, useActiveDiscordPresence, useActiveDiscordUser, useColourScheme, useDiscordPresenceSource, User } from '../util.js';
import DiscordPresenceSource from './discord.js';
import { BORDER_COLOUR_DARK, BORDER_COLOUR_LIGHT, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, NSO_COLOUR, NSO_COLOUR_DARK, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';

export default function Sidebar(props: {
    users?: User[] | null;
    selectedUser?: string;
    onSelectUser?: (na_id: string) => void;
    insetTitleBarControls?: boolean;
    children?: React.ReactNode;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();
    const presence = useActiveDiscordPresence();
    const discord_user = useActiveDiscordUser();

    return <View style={[styles.sidebar, theme.sidebar]}>
        <View style={[styles.top, theme.top, props.insetTitleBarControls ? styles.insetTitleBarControls : null]}>
            <Text style={styles.topText}>nxapi</Text>
            <Text style={styles.topText}>Nintendo Switch Online</Text>
        </View>

        <ScrollView style={styles.scroller}>
            <View style={styles.main}>
                {discord_presence_source_state === RequestState.LOADED ?
                    <DiscordPresenceSource source={discord_presence_source}
                        presence={presence} user={discord_user} /> : null}

                {props.users?.length ? <View style={styles.users}>
                    {props.users.map(u => <User
                        key={u.user.id}
                        user={u}
                        selected={props.selectedUser === u.user.id}
                        onPress={() => props.onSelectUser?.call(null, u.user.id)}
                    />)}
                </View> : null}

                {props.users ? <TouchableOpacity onPress={() => ipc.showAddUserMenu()} style={styles.addUser}>
                    <Text style={theme.text}>Add user</Text>
                </TouchableOpacity> : null}

                {discord_presence_source_state === RequestState.LOADED && !discord_presence_source ? <TouchableOpacity
                    onPress={() => ipc.showDiscordModal()} style={styles.discordSetup}
                >
                    <Text style={theme.text}>Set up Discord Rich Presence</Text>
                </TouchableOpacity> : null}

                {props.children}
            </View>
        </ScrollView>
    </View>;
}

function User(props: {
    user: User;
    selected?: boolean;
    onPress?: () => void;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const onContextMenu = useCallback(() => {
        ipc.showUserMenu(props.user.user, props.user.nso?.nsoAccount.user);
    }, [ipc, props.user.user, props.user.nso?.nsoAccount.user]);

    const miiImageSource: ImageURISource = props.user.user.mii ? {
        uri: 'https://' + props.user.user.mii.imageOrigin + '/2.0.0/mii_images/' +
            props.user.user.mii.id + '/' +
            props.user.user.mii.etag + '.png' +
            '?type=face&width=140&bgColor=DFDFDFFF',
        width: 32,
        height: 32,
    } : {
        uri: 'https://cdn.accounts.nintendo.com/account/images/common/defaults/mii.png',
        width: 32,
        height: 32,
    };

    const touchable = <TouchableOpacity onPress={props.onPress}>
        <View style={[styles.user, props.selected ? theme.userSelected : null]}>
            <View style={styles.userMii}>
                <Image source={miiImageSource} style={styles.userMiiImage} />
            </View>

            <View style={styles.userMain}>
                <Text style={[styles.userName, theme.text]}>{props.user.user.nickname}</Text>

                {props.user.nso ? <View style={styles.userNso}>
                    <View style={styles.userNsoImage}>
                        <Image source={{uri: props.user.nso.nsoAccount.user.imageUri, width: 16, height: 16}} />
                    </View>

                    <Text style={[styles.userNsoName, theme.text]}>{props.user.nso.nsoAccount.user.name}</Text>
                </View> : null}
            </View>
        </View>
    </TouchableOpacity>;

    return Platform.OS === 'web' ? <View
        // @ts-expect-error react-native-web
        onContextMenu={onContextMenu}
    >{touchable}</View> : touchable;
}

const styles = StyleSheet.create({
    sidebar: {
        flex: 1,
        maxWidth: 250,
        borderRightWidth: ipc.platform === 'win32' ? 0 : 1,
    },

    top: {
        backgroundColor: NSO_COLOUR,
        paddingVertical: 28,
        paddingHorizontal: 20,
    },
    insetTitleBarControls: {
        paddingTop: 58,
    },
    topText: {
        fontSize: 16,
        fontWeight: '600',
        color: TEXT_COLOUR_DARK,
    },

    scroller: {
        flex: 1,
    },
    main: {
        paddingBottom: 16,
    },

    users: {
        marginTop: 16,
    },

    addUser: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 20,
    },
    addUserButton: {
        marginTop: 5,
    },

    discordSetup: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 20,
    },

    user: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    userMii: {
        marginRight: 14,
    },
    userMiiImage: {
        borderRadius: 16,
    },

    userMain: {
        flex: 1,
    },
    userName: {
    },

    userNso: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        marginTop: 5,
    },
    userNsoImage: {
        marginRight: 7,
    },
    userNsoName: {
        opacity: 0.7,
        fontSize: 12,
    },
});

const light = StyleSheet.create({
    sidebar: {
        borderRightColor: BORDER_COLOUR_LIGHT,
    },
    top: {
    },
    userSelected: {
        backgroundColor: HIGHLIGHT_COLOUR_LIGHT,
    },
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    sidebar: {
        borderRightColor: BORDER_COLOUR_DARK,
    },
    top: {
        backgroundColor: NSO_COLOUR_DARK,
    },
    userSelected: {
        backgroundColor: HIGHLIGHT_COLOUR_DARK,
    },
    text: {
        color: TEXT_COLOUR_DARK,
    },
});
