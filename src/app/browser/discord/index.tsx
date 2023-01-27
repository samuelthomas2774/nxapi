import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from 'react-native-web';
import { DiscordPresenceSource } from '../../common/types.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, Root, useAccentColour, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener, User } from '../util.js';

export interface DiscordSetupProps {
    users?: string[];
    friend_nsa_id?: string;
    /** @default true */
    show_preferences_button?: boolean;
}

enum DiscordSourceType {
    CORAL,
    URL,
    NONE,
}

export default function DiscordSetupWindow(props: DiscordSetupProps) {
    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);
    useEventListener(events, 'window:refresh', () => forceRefreshAccounts(), []);

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();

    useEffect(() => {
        const handler = (event: KeyboardEvent) => event.key === 'Escape' && window.close();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (!users || discord_presence_source_state !== RequestState.LOADED) {
        return null;
    }

    return <Root
        title={i18n => i18n.t('discordsetup_window:title')} scrollable autoresize
        i18nNamespace="discordsetup_window"
    >
        <DiscordSetup
            users={users} showUsers={props.users}
            friendNsaId={props.friend_nsa_id}
            discordPresenceSource={discord_presence_source}
            showPreferencesButton={props.show_preferences_button}
        />
    </Root>;
}

function DiscordSetup(props: {
    users: User[];
    showUsers?: string[];
    friendNsaId?: string;
    discordPresenceSource: DiscordPresenceSource | null;
    showPreferencesButton?: boolean;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('discordsetup_window');

    const [selectedMode, setSelectedMode] = useState(props.users?.length && props.friendNsaId ?
        DiscordSourceType.CORAL : DiscordSourceType.NONE);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedFriendNsaId, setSelectedFriendNsaId] = useState<string | null>(props.friendNsaId ?? null);
    const [presenceUrl, setPresenceUrl] = useState('');

    useEffect(() => {
        if (!props.discordPresenceSource) {
            setSelectedMode(props.friendNsaId ? DiscordSourceType.CORAL : DiscordSourceType.NONE);
        } else if ('na_id' in props.discordPresenceSource) {
            setSelectedMode(DiscordSourceType.CORAL);
            setSelectedUserId(props.discordPresenceSource.na_id);
            setSelectedFriendNsaId(props.discordPresenceSource.friend_nsa_id ?? null);
        } else if ('url' in props.discordPresenceSource) {
            setSelectedMode(DiscordSourceType.URL);
            setPresenceUrl(props.discordPresenceSource.url);
        }
    }, [props.discordPresenceSource]);

    const user = useMemo(() => selectedUserId ? props.users?.find(u => u.user.id === selectedUserId) : undefined,
        [selectedUserId, props.users]);
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => user?.nsotoken ?
        ipc.getNsoFriends(user.nsotoken) : Promise.resolve(null), [ipc, user?.nsotoken]));
    const friends_with_presence = useMemo(() => friends?.filter(f => f.presence.updatedAt ||
        f.nsaId === selectedFriendNsaId), [friends, selectedFriendNsaId]);
    const friend = useMemo(() => selectedFriendNsaId ? friends?.find(f => f.nsaId === selectedFriendNsaId) : undefined,
        [selectedFriendNsaId, friends]);

    const filtered_users = useMemo(() => props.users.filter(u => selectedUserId === u.user.id ||
        (u.nso && (!props.showUsers || props.showUsers.includes(u.user.id)))),
        [props.users, props.showUsers, selectedUserId]);

    useEventListener(events, 'window:refresh', () => forceRefreshFriends(), []);

    useEffect(() => {
        if (filtered_users?.length && !user) setSelectedUserId(filtered_users[0].user.id);
    }, [filtered_users, user]);

    useEffect(() => {
        if (friends?.length && !friend) setSelectedFriendNsaId(friends[0].nsaId);
    }, [friends, user]);

    const save = useCallback(async () => {
        if (selectedMode === DiscordSourceType.CORAL) {
            if (!selectedUserId?.match(/^[0-9a-f]{16}$/)) throw new Error('Invalid Nintendo Account ID');
            if (!selectedFriendNsaId?.match(/^[0-9a-f]{16}$/)) throw new Error('Invalid friend Network Service Account ID');

            await ipc.setDiscordPresenceSource({na_id: selectedUserId, friend_nsa_id: selectedFriendNsaId});
        } else if (selectedMode === DiscordSourceType.URL) {
            await ipc.setDiscordPresenceSource({url: presenceUrl});
        } else {
            await ipc.setDiscordPresenceSource(null);
        }

        window.close();
    }, [selectedMode, selectedUserId, selectedFriendNsaId, presenceUrl]);

    return <View style={styles.main}>
        <Text style={theme.text}>{t('title')}</Text>

        <Text style={[styles.header, theme.text]}>{t('mode_heading')}</Text>

        <Picker<DiscordSourceType> selectedValue={selectedMode} onValueChange={v => setSelectedMode(parseInt(v))}
            style={[styles.picker, theme.picker]}
        >
            <Picker.Item label={t('mode_coral_friend')!} value={DiscordSourceType.CORAL} />
            <Picker.Item label={t('mode_url')!} value={DiscordSourceType.URL} />
            <Picker.Item label={t('mode_none')!} value={DiscordSourceType.NONE} />
        </Picker>

        {selectedMode === DiscordSourceType.CORAL ? <>
            <Text style={[styles.header, theme.text]}>{t('coral_user_heading')}</Text>
            <Text style={[styles.help, theme.text]}>{t('coral_user_help')}</Text>

            <Picker<string> selectedValue={selectedUserId ?? ''} onValueChange={setSelectedUserId}
                style={[styles.picker, theme.picker]}
            >
                {filtered_users?.map(u => <Picker.Item
                    key={u.user.id}
                    label={u.user.nickname +
                        (u.user.nickname !== u.nso!.nsoAccount.user.name ? '/' + u.nso!.nsoAccount.user.name : '')}
                    value={u.user.id}
                />)}
            </Picker>

            {props.friendNsaId && (!selectedFriendNsaId || selectedFriendNsaId === props.friendNsaId) ? <>
                <Text style={[styles.header, theme.text]}>{t('coral_friend_heading')}</Text>
                <Text style={[styles.help, theme.text]}>{t('coral_friend_help')}</Text>

                <Picker<string> selectedValue={selectedFriendNsaId ?? ''} onValueChange={setSelectedFriendNsaId}
                    style={[styles.picker, theme.picker]}
                    enabled={false}
                >
                    <Picker.Item key={props.friendNsaId} label={friend?.name ?? props.friendNsaId}
                        value={props.friendNsaId} />
                </Picker>
            </> : user && friends_with_presence ? <>
                <Text style={[styles.header, theme.text]}>{t('coral_friend_heading')}</Text>
                <Text style={[styles.help, theme.text]}>{t('coral_friend_help')}</Text>

                <Picker<string> selectedValue={selectedFriendNsaId ?? ''} onValueChange={setSelectedFriendNsaId}
                    style={[styles.picker, theme.picker]}
                >
                    {friends_with_presence.map(f => <Picker.Item key={f.nsaId} label={f.name} value={f.nsaId} />)}
                </Picker>
            </> : null}
        </> : null}

        {selectedMode === DiscordSourceType.URL ? <>
            <Text style={[styles.header, theme.text]}>{t('url_heading')}</Text>
            <Text style={[styles.help, theme.text]}>{t('url_help')}</Text>

            <TextInput value={presenceUrl} onChangeText={setPresenceUrl}
                placeholder="https://nxapi.example.com/api/znc/friend/..."
                style={[styles.textInput, theme.textInput]} />
        </> : null}

        {props.discordPresenceSource && (props.showPreferencesButton ?? true) ? <>
            <Text style={[styles.help, styles.header, theme.text]}>{t('preferences_heading')}</Text>
            <View style={[styles.button, styles.buttonPreferences]}>
                <Button title={t('preferences')!}
                    onPress={() => ipc.showPreferencesWindow()}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
        </> : null}

        <View style={styles.buttons}>
            <View style={styles.button}>
                <Button title={t('cancel')!}
                    onPress={() => window.close()}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
            <View style={styles.button}>
                <Button title={t('save')!}
                    onPress={save}
                    primary
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
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

    header: {
        marginTop: 12,
    },
    help: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
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

    buttons: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    button: {
        marginLeft: 10,
    },
    buttonPreferences: {
        marginTop: 10,
        marginLeft: 0,
        flexDirection: 'row',
        justifyContent: 'flex-start',
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
