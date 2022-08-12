import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, NativeSyntheticEvent, StyleSheet, Text, TextInput, TextInputChangeEventData, TextInputKeyPressEventData, TouchableOpacity, useColorScheme, View } from 'react-native';
import { Friend, FriendCodeUser } from '../../../api/coral-types.js';
import Warning from '../components/icons/warning.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { RequestState, Root, useAsync, useEventListener } from '../util.js';

export interface AddFriendProps {
    user: string;
    friendcode?: string;
}

enum SendFriendRequestState {
    NOT_LOADING,
    SENDING,
    SENT,
    ERROR,
}
type SendFriendRequestStateArray =
    [SendFriendRequestState.NOT_LOADING] |
    [SendFriendRequestState.SENDING, FriendCodeUser, string] |
    [SendFriendRequestState.SENT, FriendCodeUser, string, Friend | null] |
    [SendFriendRequestState.ERROR, FriendCodeUser, string, Error];

const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;
const FRIEND_CODE_URL = /^(?!https\:\/\/lounge\.nintendo\.com\/|com\.nintendo\.znca\:\/\/znca\/)friendcode\/(\d{4}-\d{4}-\d{4})\//;

export default function AddFriend(props: AddFriendProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [token] = useAsync(useCallback(() => ipc.getNintendoAccountCoralToken(props.user), [ipc, props.user]));
    const [user] = useAsync(useCallback(() => token ?
        ipc.getSavedCoralToken(token) : Promise.resolve(null), [ipc, token]));

    const [friendcode, setFriendCode] = useState(props.friendcode ?? '');
    const is_valid_friendcode = FRIEND_CODE.test(friendcode);
    const show_friendcode_field = !props.friendcode || !FRIEND_CODE.test(props.friendcode);

    const onChangeFriendCode = useCallback((event: NativeSyntheticEvent<TextInputChangeEventData>) => {
        let match;
        if (match = event.nativeEvent.text.match(FRIEND_CODE_URL)) {
            setFriendCode(match[1]);
        } else {
            const friendcode = event.nativeEvent.text
                .replace(/[^0-9]/g, '')
                .replace(/^([0-9]{4})/g, '$1-')
                .replace(/^([0-9]{4}-[0-9]{4})/g, '$1-')
                .substr(0, 14);

            setFriendCode(friendcode);
        }
    }, []);

    const [target_user, lookup_error, lookup_state] = useAsync(useCallback(() => token && is_valid_friendcode ?
        ipc.getNsoUserByFriendCode(token, friendcode) : Promise.resolve(null),
        [ipc, token, friendcode, is_valid_friendcode]));

    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => token ?
        ipc.getNsoFriends(token) : Promise.resolve(null), [ipc, token]));
    const friend = friends?.find(f => f.nsaId === target_user?.nsaId);

    const showLookupErrorDetails = useCallback(() => {
        alert(lookup_error);
    }, [lookup_error]);

    const [send_state, setSendFriendRequestState] = useState<SendFriendRequestStateArray>([SendFriendRequestState.NOT_LOADING]);

    const sendFriendRequest = useCallback(async () => {
        if (send_state[0] === SendFriendRequestState.SENDING) return;
        if (!token || !target_user) return;
        setSendFriendRequestState([SendFriendRequestState.SENDING, target_user, friendcode]);

        try {
            const {result, friend} = await ipc.addNsoFriend(token, target_user.nsaId);

            setSendFriendRequestState([SendFriendRequestState.SENT, target_user, friendcode, friend]);
        } catch (err) {
            setSendFriendRequestState([SendFriendRequestState.ERROR, target_user, friendcode, err as Error]);
        }
    }, [token, target_user, friendcode, send_state]);

    const showSendFriendRequestErrorDetails = useCallback(() => {
        if (send_state[0] !== SendFriendRequestState.ERROR) return;
        alert(send_state[3]);
    }, [send_state]);

    const onFriendCodeKeyPress = useCallback((event: NativeSyntheticEvent<TextInputKeyPressEventData>) =>
        event.nativeEvent.key === 'Escape' && window.close(), []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => event.key === 'Escape' && window.close();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (!user || (!show_friendcode_field && lookup_state === RequestState.LOADING)) {
        return <Root title="Add friend" titleUser={user ?? undefined} autoresize={!!user}>
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
        </Root>;
    }

    return <Root title="Add friend" titleUser={user} scrollable autoresize>
        <View style={styles.main}>
            {show_friendcode_field ? <>
                <Text style={theme.text}>Add friend</Text>

                <Text style={[styles.help, theme.text]}>Type or paste a friend code or friend code URL to send a friend request.</Text>

                <View style={styles.friendCodeInputContainer}>
                    <TextInput value={friendcode} onChange={onChangeFriendCode}
                        onKeyPress={onFriendCodeKeyPress}
                        placeholder="0000-0000-0000"
                        style={[styles.textInput, styles.friendCodeInput, theme.textInput]} />

                    {lookup_state === RequestState.LOADING ?
                        <ActivityIndicator style={styles.activityIndicator} size={20} color={'#' + accent_colour} /> :
                        lookup_error ? <TouchableOpacity onPress={showLookupErrorDetails} style={styles.iconTouchable}>
                            <Text style={[styles.icon, {color: '#' + accent_colour}]}><Warning /></Text>
                        </TouchableOpacity> : null}
                </View>
            </> : lookup_error ? <TouchableOpacity onPress={showLookupErrorDetails}>
                <Text style={[styles.lookupErrorNoFriendCodeField, theme.text]}>
                    <Text style={[styles.lookupErrorIcon, {color: '#' + accent_colour}]}><Warning /></Text>
                    Error looking up friend code: {lookup_error.name} {lookup_error.message}
                </Text>
            </TouchableOpacity> : null}

            {target_user ? <View style={[
                styles.targetUser,
                !show_friendcode_field ? styles.targetUserNoFriendCodeField : null,
                theme.targetUser,
            ]}>
                <Image source={{uri: target_user.imageUri, width: 100, height: 100}} style={styles.targetUserImage} />

                <View style={styles.targetUserDetail}>
                    <Text style={[styles.targetUserName, theme.text]}>{target_user.name}</Text>

                    <Text style={[styles.targetUserNsaId, theme.text]}>NSA ID: <Text style={styles.targetUserNsaIdValue}>{target_user.nsaId}</Text></Text>
                    <Text style={[styles.targetUserCoralId, theme.text]}>{target_user.id ? <>
                        Coral user ID: <Text style={styles.targetUserCoralIdValue}>{target_user.id}</Text>
                    </> : 'Never used Nintendo Switch Online app'}</Text>

                    {send_state[0] === SendFriendRequestState.SENT && send_state[3] ?
                        <Text style={[styles.friendRequestState, theme.text]}>You are now friends with this user.</Text> :
                    send_state[0] === SendFriendRequestState.SENT ?
                        <Text style={[styles.friendRequestState, theme.text]}>Friend request sent. {target_user.name} can accept your friend request using a Nintendo Switch console, or by sending you a friend request using the Nintendo Switch Online app or nxapi.</Text> :
                    send_state[0] === SendFriendRequestState.SENDING ?
                        <Text style={[styles.friendRequestState, theme.text]}>
                            <ActivityIndicator style={styles.friendRequestActivityIndicator} color={'#' + accent_colour} />
                            Sending friend request...
                        </Text> :
                    send_state[0] === SendFriendRequestState.ERROR ?
                        <TouchableOpacity onPress={showSendFriendRequestErrorDetails}>
                            <Text style={[styles.friendRequestState, theme.text]}>
                                <Text style={[styles.friendRequestStateIcon, {color: '#' + accent_colour}]}><Warning /></Text>
                                Error sending friend request: {send_state[3].name} {send_state[3].message}
                            </Text>
                        </TouchableOpacity> :
                    friend ?
                        <Text style={[styles.friendRequestState, theme.text]}>You are already friends with this user.</Text> : null}
                </View>
            </View> : null}

            <View style={styles.buttons}>
                <View style={styles.button}>
                    <Button title="Close"
                        onPress={() => window.close()}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View>

                {lookup_state === RequestState.LOADED && target_user &&
                    friends_state === RequestState.LOADED && !friend &&
                    target_user?.nsaId !== user.nsoAccount.user.nsaId ? <View style={styles.button}>
                    <Button title="Send friend request"
                        onPress={sendFriendRequest}
                        primary
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View> : null}
            </View>
        </View>
    </Root>;
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        paddingVertical: 50,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },

    main: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: 20,
    },

    help: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
    },

    friendCodeInputContainer: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    friendCodeInput: {
        marginTop: 0,
        flex: 1,
        fontSize: 18,
        fontFamily: 'monospace',
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    activityIndicator: {
        marginLeft: 10,
    },
    iconTouchable: {
        marginLeft: 10,
        justifyContent: 'center',
    },
    icon: {
        fontSize: 20,
    },

    textInput: {
        marginTop: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 3,
        fontSize: 13,
    },
    
    lookupErrorNoFriendCodeField: {
    },
    lookupErrorIcon: {
        marginRight: 10,
    },

    targetUser: {
        marginTop: 20,
        padding: 14,
        borderRadius: 3,
        flexDirection: 'row',
    },
    targetUserNoFriendCodeField: {
        marginTop: 0,
    },
    targetUserImage: {
        marginRight: 14,
        width: 100,
    },

    targetUserDetail: {
        flex: 1,
    },
    targetUserName: {
        fontSize: 18,
        fontWeight: '500',
        marginBottom: 8,
    },

    targetUserNsaId: {
        fontSize: 13,
        opacity: 0.7,
    },
    targetUserNsaIdValue: {
        fontFamily: 'monospace',
        userSelect: 'all',
    },
    targetUserCoralId: {
        fontSize: 13,
        opacity: 0.7,
    },
    targetUserCoralIdValue: {
        fontFamily: 'monospace',
        userSelect: 'all',
    },

    friendRequestState: {
        marginTop: 10,
    },
    friendRequestActivityIndicator: {
        marginRight: 10,
    },
    friendRequestStateIcon: {
        marginRight: 10,
    },

    buttons: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    button: {
        marginLeft: 10,
    },
});

const light = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
    textInput: {
        backgroundColor: HIGHLIGHT_COLOUR_LIGHT,
        color: TEXT_COLOUR_LIGHT,
    },
    targetUser: {
        backgroundColor: HIGHLIGHT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_DARK,
    },
    textInput: {
        backgroundColor: HIGHLIGHT_COLOUR_DARK,
        color: TEXT_COLOUR_DARK,
    },
    targetUser: {
        backgroundColor: HIGHLIGHT_COLOUR_DARK,
    },
});
