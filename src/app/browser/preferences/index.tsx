import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableHighlight, TouchableOpacity, useColorScheme, View } from 'react-native';
import { CheckBox, Picker } from 'react-native-web';
import { DiscordPresencePlayTime } from '../../../discord/types.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, Root, useAsync, useDiscordPresenceSource, useEventListener } from '../util.js';

export interface PreferencesProps {}

export default function Preferences(props: PreferencesProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);

    const [login_item, ,, forceRefreshLoginItem] = useAsync(useCallback(() => ipc.getLoginItemSettings(), [ipc]));

    const setOpenAtLogin = useCallback(async (open_at_login: boolean | 'mixed') => {
        await ipc.setLoginItemSettings({...login_item, openAtLogin: !!open_at_login});
        forceRefreshLoginItem();
    }, [ipc, login_item]);
    const setOpenAsHidden = useCallback(async (open_as_hidden: boolean | 'mixed') => {
        await ipc.setLoginItemSettings({...login_item, openAsHidden: !!open_as_hidden});
        forceRefreshLoginItem();
    }, [ipc, login_item]);

    const [discord_users, discord_users_error, discord_users_state, forceRefreshDiscordUsers] =
        useAsync(useCallback(() => ipc.getDiscordUsers(), [ipc]));

    const [discord_options, , discord_options_state, forceRefreshDiscordOptions] =
        useAsync(useCallback(() => ipc.getSavedDiscordPresenceOptions(), [ipc]));

    const [discord_friend_code, setDiscordFriendCodeValue] = useState(discord_options?.friend_code ?? '');
    const discord_friend_code_valid = !discord_friend_code || discord_friend_code.match(/^\d{4}-\d{4}-\d{4}$/);

    useEffect(() => {
        setDiscordFriendCodeValue(discord_options?.friend_code ?? '');
    }, [discord_options]);

    const setDiscordUser = useCallback(async (user: string | undefined) => {
        if (user === '*') user = undefined;
        await ipc.setDiscordPresenceOptions({...discord_options, user});
        forceRefreshDiscordOptions();
    }, [ipc, discord_options]);
    const setDiscordFriendCode = useCallback(async (friend_code: string | undefined) => {
        setDiscordFriendCodeValue(friend_code ?? '');
        if (friend_code && !friend_code.match(/^\d{4}-\d{4}-\d{4}$/)) return;
        if (!friend_code) friend_code = undefined;
        await ipc.setDiscordPresenceOptions({...discord_options, friend_code});
        forceRefreshDiscordOptions();
    }, [ipc, discord_options]);
    const setDiscordShowConsoleOnline = useCallback(async (show_console_online: boolean | 'mixed') => {
        await ipc.setDiscordPresenceOptions({...discord_options, show_console_online: !!show_console_online});
        forceRefreshDiscordOptions();
    }, [ipc, discord_options]);
    const setDiscordShowPlayTime = useCallback(async (show_play_time: DiscordPresencePlayTime) => {
        await ipc.setDiscordPresenceOptions({...discord_options, show_play_time});
        forceRefreshDiscordOptions();
    }, [ipc, discord_options]);

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();

    const discord_presence_source_user = discord_presence_source && 'na_id' in discord_presence_source ?
        discord_presence_source.friend_nsa_id ?
            users?.find(u => u.nso?.nsoAccount.user.nsaId === discord_presence_source.friend_nsa_id)?.nso :
            users?.find(u => u.nso?.user.id === discord_presence_source.na_id)?.nso :
        null;

    const discord_friend_code_self = discord_presence_source_user?.nsoAccount.user.links.friendCode.id;
    const [is_discord_friend_code_self, setIsDiscordFriendCodeSelf] = useState(false);
    useEffect(() => {
        setIsDiscordFriendCodeSelf(!!discord_presence_source && (!discord_friend_code || discord_friend_code === discord_friend_code_self));
    }, [discord_presence_source, discord_friend_code_self]);

    useEventListener(events, 'window:refresh', () => (
        forceRefreshAccounts(), forceRefreshLoginItem(),
        forceRefreshDiscordUsers(), forceRefreshDiscordOptions()
    ), []);

    if (!users ||
        !login_item ||
        !discord_options ||
        discord_presence_source_state !== RequestState.LOADED
    ) {
        return null;
    }

    const discord_user_picker = [<Picker.Item key="*" label="First discovered" value="*" />];

    if (discord_options?.user && !discord_users?.find(u => u.id === discord_options.user)) {
        discord_user_picker.push(<Picker.Item key={discord_options?.user} label={discord_options.user}
            value={discord_options.user} />);
    }
    for (const user of discord_users ?? []) {
        discord_user_picker.push(<Picker.Item key={user.id} label={user.username + '#' + user.discriminator}
            value={user.id} />);
    }

    return <Root title="Preferences" scrollable autoresize>
        <View style={styles.main}>
            {/* <Text style={theme.text}>Preferences</Text> */}

            {ipc.platform === 'darwin' || ipc.platform === 'win32' ? <View style={styles.section}>
                <View style={styles.sectionLeft}>
                    <Text style={[styles.label, theme.text]}>Startup</Text>
                </View>
                <View style={styles.sectionRight}>
                    {/* <Text style={theme.text}>Launch at startup menu here</Text>
                    <Text style={theme.text}>{JSON.stringify(login_item, null, 4)}</Text> */}

                    <View style={styles.checkboxContainer}>
                        <CheckBox
                            value={login_item.openAtLogin}
                            onValueChange={setOpenAtLogin}
                            color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                            style={styles.checkbox}
                        />
                        <TouchableOpacity style={styles.checkboxLabel} onPress={() => setOpenAtLogin(!login_item.openAtLogin)}>
                            <Text style={[styles.checkboxLabelText, theme.text]}>Open at login</Text>
                        </TouchableOpacity>
                    </View>

                    {ipc.platform === 'darwin' ? <View
                        style={[styles.checkboxContainer, !login_item.openAtLogin ? styles.disabled : null]}
                    >
                        <CheckBox
                            value={login_item.openAsHidden}
                            onValueChange={setOpenAsHidden}
                            disabled={!login_item.openAtLogin}
                            color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                            style={styles.checkbox}
                        />
                        <TouchableOpacity disabled={!login_item.openAtLogin} style={styles.checkboxLabel}
                            onPress={() => setOpenAsHidden(!login_item.openAsHidden)}
                        >
                            <Text style={[styles.checkboxLabelText, theme.text]}>Open in background</Text>
                        </TouchableOpacity>
                    </View> : null}
                </View>
            </View> : null}

            {/* <View style={styles.section}>
                <View style={styles.sectionLeft}>
                    <Text style={[styles.label, theme.text]}>Sleep</Text>
                </View>
                <View style={styles.sectionRight}>
                    <Text style={theme.text}>Prevent sleep menu here</Text>
                </View>
            </View> */}

            <View style={styles.section}>
                <View style={styles.sectionLeft}>
                    <Text style={[styles.label, theme.text]}>Discord Rich Presence</Text>
                </View>
                <View style={styles.sectionRight}>
                    <Text style={theme.text}>Discord Rich Presence is {discord_presence_source ? 'en' : 'dis'}abled.</Text>

                    <View style={styles.button}>
                        <Button title="Discord Rich Presence setup"
                            onPress={() => ipc.showDiscordModal({show_preferences_button: false})}
                            color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                    </View>

                    <Text style={[styles.header, theme.text]}>Discord user</Text>

                    <Picker<string> selectedValue={discord_options?.user ?? '*'} onValueChange={setDiscordUser}
                        style={[styles.picker, theme.picker]}
                        enabled={discord_options_state !== RequestState.LOADING &&
                            discord_users_state !== RequestState.LOADING}
                    >{...discord_user_picker}</Picker>

                    <Text style={[styles.header, theme.text]}>Friend code</Text>
                    <Text style={[styles.help, theme.text]}>Adding your friend code will also show your Nintendo Switch user icon in Discord.</Text>

                    {is_discord_friend_code_self ? <View style={styles.friendCodeCheckbox}>
                        <View style={styles.checkboxContainer}>
                            <CheckBox
                                value={!!discord_options.friend_code}
                                onValueChange={v => setDiscordFriendCode(v ? discord_friend_code_self : undefined)}
                                color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                                style={styles.checkbox}
                            />
                            <TouchableOpacity style={styles.checkboxLabel} onPress={() => setDiscordFriendCode(discord_options.friend_code ? undefined : discord_friend_code_self)}>
                                <Text style={theme.text}>Share my friend code</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.textLinkTouchable} onPress={() => setIsDiscordFriendCodeSelf(false)}>
                            <Text style={[styles.textLink, theme.text, {color: '#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}]}>
                                Set custom friend code
                            </Text>
                        </TouchableOpacity>
                    </View> : <View style={styles.friendCodeInput}>
                        <TextInput value={discord_friend_code} onChangeText={setDiscordFriendCode}
                            placeholder="0000-0000-0000"
                            style={[styles.textInput, theme.textInput]} />
                    </View>}

                    {/* <View style={styles.header} /> */}

                    <View style={[styles.checkboxContainer, styles.checkboxContainerMargin]}>
                        <CheckBox
                            value={discord_options?.show_console_online ?? false}
                            onValueChange={setDiscordShowConsoleOnline}
                            color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                            style={styles.checkbox}
                        />
                        <TouchableOpacity style={styles.checkboxLabel} onPress={() => setDiscordShowConsoleOnline(!discord_options?.show_console_online)}>
                            <Text style={[styles.checkboxLabelText, theme.text]}>Show inactive presence</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.help, theme.text]}>Shows "Not playing" when a console linked to your account is online, but you are not selected in a game.</Text>

                    <Text style={[styles.header, theme.text]}>Play time</Text>

                    <Picker<string>
                        selectedValue={'' + (discord_options?.show_play_time ??
                            DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE)}
                        onValueChange={v => setDiscordShowPlayTime(parseInt(v))}
                        style={[styles.picker, theme.picker]}
                        enabled={discord_options_state !== RequestState.LOADING}
                    >
                        <Picker.Item key={DiscordPresencePlayTime.HIDDEN} value={DiscordPresencePlayTime.HIDDEN}
                            label="Never show play time" />
                        <Picker.Item key={DiscordPresencePlayTime.NINTENDO} value={DiscordPresencePlayTime.NINTENDO}
                            label="Show play time as it appears on a Nintendo Switch console" />
                        <Picker.Item key={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME} value={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME}
                            label="Show approximate play time (nearest 5 hours)" />
                        <Picker.Item key={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE} value={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE}
                            label="Show approximate play time (nearest 5 hours) with first played date" />
                        <Picker.Item key={DiscordPresencePlayTime.DETAILED_PLAY_TIME} value={DiscordPresencePlayTime.DETAILED_PLAY_TIME}
                            label="Show exact play time" />
                        <Picker.Item key={DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE} value={DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE}
                            label="Show exact play time with first played date" />
                    </Picker>
                </View>
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
        paddingHorizontal: 35,
    },

    section: {
        marginBottom: 15,
        flexDirection: 'row',
    },
    sectionLeft: {
        width: '30%',
        marginRight: 30,
    },
    label: {
        textAlign: 'right',
    },
    sectionRight: {
        flex: 1,
    },

    header: {
        marginTop: 12,
    },
    help: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
    },

    textLinkTouchable: {
        marginBottom: 8,
    },
    textLink: {
        fontSize: 13,
        opacity: 0.85,
    },

    picker: {
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderWidth: 0,
        borderRadius: 3,
        fontSize: 13,
    },
    textInput: {
        marginTop: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 3,
        fontSize: 13,
    },
    checkboxContainer: {
        marginBottom: 8,
        flex: 1,
        flexBasis: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxContainerMargin: {
        marginTop: 8,
        marginBottom: 0,
    },
    checkbox: {
        marginRight: 10,
    },
    checkboxLabel: {
        flex: 1,
    },
    checkboxLabelText: {
    },
    disabled: {
        opacity: 0.8,
    },

    friendCodeCheckbox: {
        marginTop: 8,
    },
    friendCodeInput: {
        marginBottom: 4,
    },

    button: {
        marginTop: 10,
        marginRight: 10,
        flexDirection: 'row',
    },
});

const light = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_LIGHT,
    },
    picker: {
        backgroundColor: HIGHLIGHT_COLOUR_LIGHT,
        color: TEXT_COLOUR_LIGHT,
    },
    textInput: {
        backgroundColor: HIGHLIGHT_COLOUR_LIGHT,
        color: TEXT_COLOUR_LIGHT,
    },
});

const dark = StyleSheet.create({
    text: {
        color: TEXT_COLOUR_DARK,
    },
    picker: {
        backgroundColor: HIGHLIGHT_COLOUR_DARK,
        color: TEXT_COLOUR_DARK,
    },
    textInput: {
        backgroundColor: HIGHLIGHT_COLOUR_DARK,
        color: TEXT_COLOUR_DARK,
    },
});
