import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { Picker } from 'react-native-web';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, Root, useAsync, useDiscordPresenceSource, useEventListener } from '../util.js';

export interface DiscordSetupProps {
    users?: string[];
    friend_nsa_id?: string;
}

enum DiscordSourceType {
    CORAL,
    URL,
    NONE,
}

export default function DiscordSetup(props: DiscordSetupProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();

    const [selectedMode, setSelectedMode] = useState(props.users?.length && props.friend_nsa_id ?
        DiscordSourceType.CORAL : DiscordSourceType.NONE);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedFriendNsaId, setSelectedFriendNsaId] = useState<string | null>(props.friend_nsa_id ?? null);
    const [presenceUrl, setPresenceUrl] = useState('');

    useEffect(() => {
        if (!discord_presence_source) {
            setSelectedMode(props.users?.length && props.friend_nsa_id ?
                DiscordSourceType.CORAL : DiscordSourceType.NONE);
        } else if ('na_id' in discord_presence_source) {
            setSelectedMode(DiscordSourceType.CORAL);
            setSelectedUserId(discord_presence_source.na_id);
            setSelectedFriendNsaId(discord_presence_source.friend_nsa_id ?? null);
        } else if ('url' in discord_presence_source) {
            setSelectedMode(DiscordSourceType.URL);
            setPresenceUrl(discord_presence_source.url);
        }
    }, [discord_presence_source]);

    const user = useMemo(() => selectedUserId ? users?.find(u => u.user.id === selectedUserId) : undefined,
        [selectedUserId, users]);
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => user?.nsotoken ?
        ipc.getNsoFriends(user.nsotoken) : Promise.resolve(null), [ipc, user?.nsotoken]));
    const friends_with_presence = useMemo(() => friends?.filter(f => f.presence.updatedAt ||
        f.nsaId === selectedFriendNsaId), [friends, selectedFriendNsaId]);
    const friend = useMemo(() => selectedFriendNsaId ? friends?.find(f => f.nsaId === selectedFriendNsaId) : undefined,
        [selectedFriendNsaId, friends]);

    const filtered_users = useMemo(() => users?.filter(u => selectedUserId === u.user.id ||
        (u.nso && (!props.users || props.users.includes(u.user.id)))), [users, props.users, selectedUserId]);

    useEventListener(events, 'window:refresh', () => (forceRefreshAccounts(), forceRefreshFriends()), []);

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

    useEffect(() => {
        const handler = (event: KeyboardEvent) => event.key === 'Escape' && window.close();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (!users || discord_presence_source_state !== RequestState.LOADED) {
        return null;
    }

    return <Root title="Discord Rich Presence setup" scrollable autoresize>
        <View style={styles.main}>
            <Text style={theme.text}>Discord Rich Presence setup</Text>

            <Text style={[styles.header, theme.text]}>1. Select mode</Text>

            <Picker<DiscordSourceType> selectedValue={selectedMode} onValueChange={v => setSelectedMode(parseInt(v))}
                style={[styles.picker, theme.picker]}
            >
                <Picker.Item label="Select a user that is friends with the user you want to share"
                    value={DiscordSourceType.CORAL} />
                <Picker.Item label="Enter a URL that returns the presence data you want to share"
                    value={DiscordSourceType.URL} />
                <Picker.Item label="Disable" value={DiscordSourceType.NONE} />
            </Picker>

            {selectedMode === DiscordSourceType.CORAL ? <>
                <Text style={[styles.header, theme.text]}>2. Select user</Text>
                <Text style={[styles.help, theme.text]}>This user must be friends with the user you want to share.</Text>

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

                {props.friend_nsa_id && (!selectedFriendNsaId || selectedFriendNsaId === props.friend_nsa_id) ? <>
                    <Text style={[styles.header, theme.text]}>3. Select friend</Text>
                    <Text style={[styles.help, theme.text]}>This is the user you want to share.</Text>

                    <Picker<string> selectedValue={selectedFriendNsaId ?? ''} onValueChange={setSelectedFriendNsaId}
                        style={[styles.picker, theme.picker]}
                        enabled={false}
                    >
                        <Picker.Item key={props.friend_nsa_id} label={friend?.name ?? props.friend_nsa_id}
                            value={props.friend_nsa_id} />
                    </Picker>
                </> : user && friends_with_presence ? <>
                    <Text style={[styles.header, theme.text]}>3. Select friend</Text>
                    <Text style={[styles.help, theme.text]}>This is the user you want to share.</Text>

                    <Picker<string> selectedValue={selectedFriendNsaId ?? ''} onValueChange={setSelectedFriendNsaId}
                        style={[styles.picker, theme.picker]}
                    >
                        {friends_with_presence.map(f => <Picker.Item key={f.nsaId} label={f.name} value={f.nsaId} />)}
                    </Picker>
                </> : null}
            </> : null}
 
            {selectedMode === DiscordSourceType.URL ? <>
                <Text style={[styles.header, theme.text]}>2. Enter presence URL</Text>
                <Text style={[styles.help, theme.text]}>This must be a HTTPS URL that returns a JSON object with either a user, friend or presence key. This is intended to be used with nxapi's znc API proxy.</Text>

                <TextInput value={presenceUrl} onChangeText={setPresenceUrl}
                    placeholder="https://nxapi.example.com/api/znc/friend/..."
                    style={[styles.textInput, theme.textInput]} />
            </> : null}

            <View style={styles.buttons}>
                <View style={styles.button}>
                    <Button title="Cancel"
                        onPress={() => window.close()}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View>
                <View style={styles.button}>
                    <Button title="Save"
                        onPress={save}
                        primary
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
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
