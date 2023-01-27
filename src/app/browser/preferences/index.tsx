import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CheckBox, Picker } from 'react-native-web';
import { DiscordPresencePlayTime } from '../../../discord/types.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, Root, useAccentColour, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener } from '../util.js';

export interface PreferencesProps {}

export default function PreferencesWindow(props: PreferencesProps) {
    return <Root
        title={i18n => i18n.t('preferences_window:title')} scrollable autoresize
        i18nNamespace="preferences_window"
    >
        <Preferences />
    </Root>;
}

function _Preferences(props: {
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n, ready } = useTranslation('preferences_window');

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);

    const [login_item, ,, forceRefreshLoginItem] = useAsync(useCallback(() => ipc.getLoginItemSettings(), [ipc]));

    const setOpenAtLogin = useCallback(async (open_at_login: boolean | 'mixed') => {
        await ipc.setLoginItemSettings({...login_item!, startup_enabled: !!open_at_login});
        forceRefreshLoginItem();
    }, [ipc, login_item]);
    const setOpenAsHidden = useCallback(async (open_as_hidden: boolean | 'mixed') => {
        await ipc.setLoginItemSettings({...login_item!, startup_hidden: !!open_as_hidden});
        forceRefreshLoginItem();
    }, [ipc, login_item]);

    const [discord_users, discord_users_error, discord_users_state, forceRefreshDiscordUsers] =
        useAsync(useCallback(() => ipc.getDiscordUsers(), [ipc]));

    const [discord_options, , discord_options_state, forceRefreshDiscordOptions] =
        useAsync(useCallback(() => ipc.getSavedDiscordPresenceOptions(), [ipc]));
    const [has_ever_loaded_discord_options, setHasLoadedDiscordOptions] = useReducer(() => true, false);
    useEffect(() => (discord_options_state === RequestState.LOADED && setHasLoadedDiscordOptions(), undefined));

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
    const setDiscordEnableSplatNet3Monitor = useCallback(async (enable_splatnet3_monitoring: boolean | 'mixed') => {
        await ipc.setDiscordPresenceOptions({...discord_options, monitors: {...discord_options?.monitors,
            enable_splatnet3_monitoring: !!enable_splatnet3_monitoring}});
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
        setIsDiscordFriendCodeSelf(!!discord_friend_code_self &&
            (!discord_friend_code || discord_friend_code === discord_friend_code_self));
    }, [discord_presence_source, discord_friend_code_self]);

    useEventListener(events, 'window:refresh', () => (
        forceRefreshAccounts(), forceRefreshLoginItem(),
        forceRefreshDiscordUsers(), forceRefreshDiscordOptions()
    ), []);

    if (!users ||
        !login_item ||
        !has_ever_loaded_discord_options ||
        discord_presence_source_state !== RequestState.LOADED ||
        !ready
    ) {
        return null;
    }

    const discord_user_picker = [<Picker.Item key="*" label={t('discord.user_any')!} value="*" />];

    if (discord_options?.user && !discord_users?.find(u => u.id === discord_options.user)) {
        discord_user_picker.push(<Picker.Item key={discord_options?.user} label={discord_options.user}
            value={discord_options.user} />);
    }
    for (const user of discord_users ?? []) {
        discord_user_picker.push(<Picker.Item key={user.id} label={user.username + '#' + user.discriminator}
            value={user.id} />);
    }

    return <View style={styles.main}>
        {/* <Text style={theme.text}>Preferences</Text> */}

        {login_item.supported || login_item.startup_enabled ? <View style={styles.section}>
            <View style={styles.sectionLeft}>
                <Text style={[styles.label, theme.text]}>{t('startup.heading')}</Text>
            </View>
            <View style={styles.sectionRight}>
                <View style={styles.checkboxContainer}>
                    <CheckBox
                        value={login_item.startup_enabled}
                        onValueChange={setOpenAtLogin}
                        disabled={!login_item.supported}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                        style={styles.checkbox}
                    />
                    <TouchableOpacity disabled={!login_item.supported} style={styles.checkboxLabel} onPress={() => setOpenAtLogin(!login_item.startup_enabled)}>
                        <Text style={[styles.checkboxLabelText, theme.text]}>{t('startup.login')}</Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={[styles.checkboxContainer, !login_item.startup_enabled ? styles.disabled : null]}
                >
                    <CheckBox
                        value={login_item.startup_hidden}
                        onValueChange={setOpenAsHidden}
                        disabled={!login_item.startup_enabled}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                        style={styles.checkbox}
                    />
                    <TouchableOpacity disabled={!login_item.startup_enabled} style={styles.checkboxLabel}
                        onPress={() => setOpenAsHidden(!login_item.startup_hidden)}
                    >
                        <Text style={[styles.checkboxLabelText, theme.text]}>{t('startup.background')}</Text>
                    </TouchableOpacity>
                </View>
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
                <Text style={[styles.label, theme.text]}>{t('discord.heading')}</Text>
            </View>
            <View style={styles.sectionRight}>
                <Text style={theme.text}>{t(discord_presence_source ? 'discord.enabled' : 'discord.disabled')}</Text>

                <View style={styles.button}>
                    <Button title={t('discord.setup')}
                        onPress={() => ipc.showDiscordModal({show_preferences_button: false})}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View>

                <Text style={[styles.header, theme.text]}>{t('discord.user')}</Text>

                <Picker<string> selectedValue={discord_options?.user ?? '*'} onValueChange={setDiscordUser}
                    style={[styles.picker, theme.picker]}
                    enabled={discord_options_state !== RequestState.LOADING &&
                        discord_users_state !== RequestState.LOADING}
                >{...discord_user_picker}</Picker>

                <Text style={[styles.header, theme.text]}>{t('discord.friend_code')}</Text>
                <Text style={[styles.help, theme.text]}>{t('discord.friend_code_help')}</Text>

                {is_discord_friend_code_self ? <View style={styles.friendCodeCheckbox}>
                    <View style={styles.checkboxContainer}>
                        <CheckBox
                            value={!!discord_options?.friend_code}
                            onValueChange={v => setDiscordFriendCode(v ? discord_friend_code_self : undefined)}
                            color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                            style={styles.checkbox}
                        />
                        <TouchableOpacity style={styles.checkboxLabel} onPress={() => setDiscordFriendCode(discord_options?.friend_code ? undefined : discord_friend_code_self)}>
                            <Text style={theme.text}>{t('discord.friend_code_self')}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.textLinkTouchable} onPress={() => setIsDiscordFriendCodeSelf(false)}>
                        <Text style={[styles.textLink, theme.text, {color: '#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}]}>
                            {t('discord.friend_code_custom')}
                        </Text>
                    </TouchableOpacity>
                </View> : <View style={styles.friendCodeInput}>
                    <TextInput value={discord_friend_code} onChangeText={setDiscordFriendCode}
                        placeholder="0000-0000-0000"
                        style={[styles.textInput, theme.textInput]} />
                </View>}

                <View style={[styles.checkboxContainer, styles.checkboxContainerMargin]}>
                    <CheckBox
                        value={discord_options?.show_console_online ?? false}
                        onValueChange={setDiscordShowConsoleOnline}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                        style={styles.checkbox}
                    />
                    <TouchableOpacity style={styles.checkboxLabel} onPress={() => setDiscordShowConsoleOnline(!discord_options?.show_console_online)}>
                        <Text style={[styles.checkboxLabelText, theme.text]}>{t('discord.inactive_presence')}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={[styles.help, theme.text]}>{t('discord.inactive_presence_help')}</Text>

                <Text style={[styles.header, theme.text]}>{t('discord.play_time')}</Text>

                <Picker<string>
                    selectedValue={'' + (discord_options?.show_play_time ??
                        DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE)}
                    onValueChange={v => setDiscordShowPlayTime(parseInt(v))}
                    style={[styles.picker, theme.picker]}
                    enabled={discord_options_state !== RequestState.LOADING}
                >
                    <Picker.Item key={DiscordPresencePlayTime.HIDDEN} value={DiscordPresencePlayTime.HIDDEN}
                        label={t('discord.play_time_hidden')!} />
                    <Picker.Item key={DiscordPresencePlayTime.NINTENDO} value={DiscordPresencePlayTime.NINTENDO}
                        label={t('discord.play_time_nintendo')!} />
                    <Picker.Item key={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME} value={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME}
                        label={t('discord.play_time_approximate_play_time')!} />
                    <Picker.Item key={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE} value={DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE}
                        label={t('discord.play_time_approximate_play_time_since')!} />
                    <Picker.Item key={DiscordPresencePlayTime.HOUR_PLAY_TIME} value={DiscordPresencePlayTime.HOUR_PLAY_TIME}
                        label={t('discord.play_time_hour_play_time')!} />
                    <Picker.Item key={DiscordPresencePlayTime.HOUR_PLAY_TIME_SINCE} value={DiscordPresencePlayTime.HOUR_PLAY_TIME_SINCE}
                        label={t('discord.play_time_hour_play_time_since')!} />
                    <Picker.Item key={DiscordPresencePlayTime.DETAILED_PLAY_TIME} value={DiscordPresencePlayTime.DETAILED_PLAY_TIME}
                        label={t('discord.play_time_detailed_play_time')!} />
                    <Picker.Item key={DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE} value={DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE}
                        label={t('discord.play_time_detailed_play_time_since')!} />
                </Picker>
            </View>
        </View>

        <View style={styles.section}>
            <View style={styles.sectionLeft}>
                <Text style={[styles.label, theme.text]}>{t('splatnet3.heading')}</Text>
            </View>
            <View style={styles.sectionRight}>
                <View style={[styles.checkboxContainer]}>
                    <CheckBox
                        value={discord_options?.monitors?.enable_splatnet3_monitoring ?? false}
                        onValueChange={setDiscordEnableSplatNet3Monitor}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                        style={styles.checkbox}
                    />
                    <TouchableOpacity style={styles.checkboxLabel} onPress={() => setDiscordEnableSplatNet3Monitor(!discord_options?.monitors?.enable_splatnet3_monitoring)}>
                        <Text style={[styles.checkboxLabelText, theme.text]}>{t('splatnet3.discord')}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={[styles.help, theme.text]}>{t('splatnet3.discord_help_1')}</Text>
                <Text style={[styles.help, theme.text]}>{t('splatnet3.discord_help_2')}</Text>
            </View>
        </View>
    </View>;
}

const Preferences = React.memo(_Preferences);

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
