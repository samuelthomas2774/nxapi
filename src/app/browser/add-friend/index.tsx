import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, NativeSyntheticEvent, StyleSheet, Text, TextInput, TextInputChangeEventData, TextInputKeyPressEventData, TouchableOpacity, View } from 'react-native';
import { Friend, FriendCodeUser } from '../../../api/coral-types.js';
import { SavedToken } from '../../../common/auth/coral.js';
import Warning from '../components/icons/warning.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc from '../ipc.js';
import { RequestState, Root, useAccentColour, useAsync, useColourScheme } from '../util.js';

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

export default function AddFriendWindow(props: AddFriendProps) {
    const accent_colour = useAccentColour();

    const [token] = useAsync(useCallback(() => ipc.getNintendoAccountCoralToken(props.user), [ipc, props.user]));
    const [user] = useAsync(useCallback(() => token ?
        ipc.getSavedCoralToken(token) : Promise.resolve(null), [ipc, token]));

    const [fr_received, fr_received_error, fr_received_state] = useAsync(useCallback(() => token ?
        ipc.getNsoReceivedFriendRequests(token) : Promise.resolve(null), [ipc, token]));
    const [fr_sent, fr_sent_error, fr_sent_state] = useAsync(useCallback(() => token ?
        ipc.getNsoSentFriendRequests(token) : Promise.resolve(null), [ipc, token]));

    const [friendcode, setFriendCode] = useState(props.friendcode ?? '');
    const is_valid_friendcode = FRIEND_CODE.test(friendcode);
    const show_friendcode_field = !props.friendcode || !FRIEND_CODE.test(props.friendcode);

    const [target_user, lookup_error, lookup_state] = useAsync(useCallback(() => token && is_valid_friendcode ?
        ipc.getNsoUserByFriendCode(token, friendcode) : Promise.resolve(null),
        [ipc, token, friendcode, is_valid_friendcode]));

    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => token ?
        ipc.getNsoFriends(token) : Promise.resolve(null), [ipc, token]));
    const friend = friends?.find(f => f.nsaId === target_user?.nsaId);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => event.key === 'Escape' && window.close();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (!user || !token || (!show_friendcode_field && lookup_state === RequestState.LOADING)) {
        return <Root
            title={i18n => i18n.t('addfriend_window:title')} titleUser={user ?? undefined} autoresize={!!user}
            i18nNamespace="addfriend_window"
        >
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
        </Root>;
    }

    return <Root
        title={i18n => i18n.t('addfriend_window:title')} titleUser={user} autoresize
        i18nNamespace="addfriend_window"
    >
        <AddFriend
            user={user} token={token}
            friendcode={friendcode} setFriendCode={show_friendcode_field ? setFriendCode : undefined}
            lookupState={lookup_state} lookupUser={target_user} lookupError={lookup_error}
            friendsState={friends_state} lookupFriend={friend}
        />
    </Root>;
}

function AddFriend(props: {
    user: SavedToken;
    token: string;
    friendcode: string;
    setFriendCode?: (friendcode: string) => void;
    lookupState: RequestState;
    lookupUser: FriendCodeUser | null;
    lookupError: Error | null;
    friendsState: RequestState;
    lookupFriend?: Friend;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('addfriend_window');

    const onChangeFriendCode = useCallback((event: NativeSyntheticEvent<TextInputChangeEventData>) => {
        let match;
        if (match = event.nativeEvent.text.match(FRIEND_CODE_URL)) {
            props.setFriendCode?.(match[1]);
        } else {
            const friendcode = event.nativeEvent.text
                .replace(/[^0-9]/g, '')
                .replace(/^([0-9]{4})/g, '$1-')
                .replace(/^([0-9]{4}-[0-9]{4})/g, '$1-')
                .substr(0, 14);

            props.setFriendCode?.(friendcode);
        }
    }, []);

    const showLookupErrorDetails = useCallback(() => {
        alert(props.lookupError);
    }, [props.lookupError]);

    const [send_state, setSendFriendRequestState] = useState<SendFriendRequestStateArray>([SendFriendRequestState.NOT_LOADING]);

    const sendFriendRequest = useCallback(async () => {
        if (send_state[0] === SendFriendRequestState.SENDING) return;
        if (!props.lookupUser) return;
        setSendFriendRequestState([SendFriendRequestState.SENDING, props.lookupUser, props.friendcode]);

        try {
            const {result, friend} = await ipc.addNsoFriend(props.token, props.lookupUser.nsaId);

            setSendFriendRequestState([SendFriendRequestState.SENT, props.lookupUser, props.friendcode, friend]);
        } catch (err) {
            setSendFriendRequestState([SendFriendRequestState.ERROR, props.lookupUser, props.friendcode, err as Error]);
        }
    }, [props.token, props.lookupUser, props.friendcode, send_state]);

    const showSendFriendRequestErrorDetails = useCallback(() => {
        if (send_state[0] !== SendFriendRequestState.ERROR) return;
        alert(send_state[3]);
    }, [send_state]);

    const onFriendCodeKeyPress = useCallback((event: NativeSyntheticEvent<TextInputKeyPressEventData>) =>
        event.nativeEvent.key === 'Escape' && window.close(), []);

    return <View style={styles.main}>
        {props.setFriendCode ? <>
            <Text style={theme.text}>{t('title')}</Text>

            <Text style={[styles.help, theme.text]}>{t('help')}</Text>

            <View style={styles.friendCodeInputContainer}>
                <TextInput value={props.friendcode} onChange={onChangeFriendCode}
                    onKeyPress={onFriendCodeKeyPress}
                    placeholder="0000-0000-0000"
                    style={[styles.textInput, styles.friendCodeInput, theme.textInput]} />

                {props.lookupState === RequestState.LOADING ?
                    <ActivityIndicator style={styles.activityIndicator} size={20} color={'#' + accent_colour} /> :
                    props.lookupError ? <TouchableOpacity onPress={showLookupErrorDetails} style={styles.iconTouchable}>
                        <Text style={[styles.icon, {color: '#' + accent_colour}]}><Warning /></Text>
                    </TouchableOpacity> : null}
            </View>
        </> : props.lookupError ? <TouchableOpacity onPress={showLookupErrorDetails}>
            <Text style={[styles.lookupErrorNoFriendCodeField, theme.text]}>
                <Text style={[styles.lookupErrorIcon, {color: '#' + accent_colour}]}><Warning /></Text>
                {t('lookup_error', {message: props.lookupError.name + ' ' + props.lookupError.message})}
            </Text>
        </TouchableOpacity> : null}

        {props.lookupUser ? <View style={[
            styles.targetUser,
            !props.setFriendCode ? styles.targetUserNoFriendCodeField : null,
            theme.targetUser,
        ]}>
            <Image source={{uri: props.lookupUser.imageUri, width: 100, height: 100}} style={styles.targetUserImage} />

            <View style={styles.targetUserDetail}>
                <Text style={[styles.targetUserName, theme.text]}>{props.lookupUser.name}</Text>

                <Text style={[styles.targetUserNsaId, theme.text]}>
                    {t('nsa_id')}: <Text style={styles.targetUserNsaIdValue}>{props.lookupUser.nsaId}</Text>
                </Text>
                <Text style={[styles.targetUserCoralId, theme.text]}>{props.lookupUser.id ? <>
                    {t('coral_id')}: <Text style={styles.targetUserCoralIdValue}>{props.lookupUser.id}</Text>
                </> : t('no_coral_user')}</Text>

                {send_state[0] === SendFriendRequestState.SENT && send_state[3] ?
                    <Text style={[styles.friendRequestState, theme.text]}>{t('send_added')}</Text> :
                send_state[0] === SendFriendRequestState.SENT ?
                    <Text style={[styles.friendRequestState, theme.text]}>{t('send_sent', {user: props.lookupUser.name})}</Text> :
                send_state[0] === SendFriendRequestState.SENDING ?
                    <Text style={[styles.friendRequestState, theme.text]}>
                        <ActivityIndicator style={styles.friendRequestActivityIndicator} color={'#' + accent_colour} />
                        {t('send_sending')}
                    </Text> :
                send_state[0] === SendFriendRequestState.ERROR ?
                    <TouchableOpacity onPress={showSendFriendRequestErrorDetails}>
                        <Text style={[styles.friendRequestState, theme.text]}>
                            <Text style={[styles.friendRequestStateIcon, {color: '#' + accent_colour}]}><Warning /></Text>
                            {t('send_error', {message: send_state[3].name + ' ' + send_state[3].message})}
                        </Text>
                    </TouchableOpacity> :
                props.lookupFriend ?
                    <Text style={[styles.friendRequestState, theme.text]}>{t('already_friends')}</Text> : null}
            </View>
        </View> : null}

        <View style={styles.buttons}>
            <View style={styles.button}>
                <Button title={t('close')}
                    onPress={() => window.close()}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>

            {props.lookupState === RequestState.LOADED && props.lookupUser &&
                props.friendsState === RequestState.LOADED && !props.lookupFriend &&
                props.lookupUser?.nsaId !== props.user.nsoAccount.user.nsaId ? <View style={styles.button}>
                <Button title={t('send')}
                    onPress={sendFriendRequest}
                    primary
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View> : null}
        </View>
    </View>;
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
