import React, { useCallback, useEffect } from 'react';
import { Button, Image, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Game, Presence, PresencePermissions, PresenceState } from '../../../api/znc-types.js';
import { getTitleIdFromEcUrl, hrduration } from '../../../util/misc.js';
import { TEXT_COLOUR_ACTIVE, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { RequestState, Root, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener } from '../util.js';

export interface FriendProps {
    user: string;
    friend: string;
}

export default function Friend(props: FriendProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();

    const [token] = useAsync(useCallback(() => ipc.getNintendoAccountNsoToken(props.user), [ipc, props.user]));
    const [user] = useAsync(useCallback(() => token ?
        ipc.getSavedNsoToken(token) : Promise.resolve(null), [ipc, token]));
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => token ?
        ipc.getNsoFriends(token) : Promise.resolve(null), [ipc, token]));
    const friend = friends?.find(f => f.nsaId === props.friend);

    useEffect(() => {
        if (friends_state !== RequestState.LOADED) return;

        const timeout = setTimeout(forceRefreshFriends, 60 * 1000);

        return () => clearTimeout(timeout);
    }, [ipc, token, friends_state]);

    if (friends && !friend) throw new Error('Unknown friend');
    if (!user || !friend || discord_presence_source_state !== RequestState.LOADED) return null;

    const discord_presence_active = discord_presence_source && 'na_id' in discord_presence_source &&
        discord_presence_source.na_id === user.user.id &&
        discord_presence_source.friend_nsa_id === friend.nsaId;
    const can_see_user_presence = user.nsoAccount.user.permissions.presence === PresencePermissions.FRIENDS ||
        (user.nsoAccount.user.permissions.presence === PresencePermissions.FAVORITE_FRIENDS && friend.isFavoriteFriend);

    return <Root title={friend.name} titleUser={user} scrollable>
        <View style={styles.main}>
            <View style={styles.friend}>
                <Image source={{uri: friend.imageUri, width: 130, height: 130}} style={styles.friendImage} />
                <Text style={[styles.friendName, theme.text]}>{friend.name}</Text>

                {friend.presence.updatedAt ?
                    <FriendPresence presence={friend.presence} /> :
                    <Text style={[styles.noPresence, theme.text]}>You don't have access to this user's presence, or they have never been online.</Text>}
            </View>

            <View style={styles.right}>
                <View style={styles.detail}>
                    {(friend.presence.state === PresenceState.ONLINE || friend.presence.state === PresenceState.PLAYING) &&
                        'name' in friend.presence.game ? <FriendPresenceGame game={friend.presence.game} /> : null}

                    <Text style={theme.text}>NSA ID: {friend.nsaId}</Text>
                    <Text style={theme.text}>{friend.isServiceUser ? 'Coral user ID: ' + friend.id : 'Never used Nintendo Switch Online app'}</Text>
                    <Text style={theme.text}>Friends since {new Date(friend.friendCreatedAt * 1000).toLocaleString('en-GB')}</Text>
                    {friend.presence.updatedAt ? <Text style={theme.text}>Presence updated at {new Date(friend.presence.updatedAt * 1000).toLocaleString('en-GB')}</Text> : null}
                    <Text style={theme.text}>This user {can_see_user_presence ? 'can' : 'can not'} see your presence.</Text>
                </View>

                <View style={styles.buttons}>
                    {discord_presence_active ? <Button title="Stop sharing presence to Discord"
                        onPress={() => ipc.setDiscordPresenceSource(null)}
                        color={'#' + accent_colour} /> :
                    friend.presence.updatedAt ? <Button title="Share presence to Discord"
                        onPress={() => ipc.setDiscordPresenceSource({na_id: user.user.id, friend_nsa_id: friend.nsaId})}
                        color={'#' + accent_colour} /> : null}

                    <Button title="Close"
                        onPress={() => window.close()}
                        color={'#' + accent_colour} />
                </View>
            </View>
        </View>
    </Root>;
}

function FriendPresence(props: {
    presence: Presence;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const logout = props.presence.logoutAt ? new Date(props.presence.logoutAt * 1000) : null;
    const game = 'name' in props.presence.game ? props.presence.game : null;

    if (props.presence.state === PresenceState.ONLINE || props.presence.state === PresenceState.PLAYING) {
        return <Text style={[styles.presenceText, theme.text, styles.presenceTextOnline]}>Playing {game?.name}</Text>;
    }

    return <View>
        <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>Offline</Text>
        {logout ? <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>Last seen {logout.toLocaleString('en-GB')}</Text> : null}
    </View>;
}

function FriendPresenceGame(props: {
    game: Game;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;

    const titleid = getTitleIdFromEcUrl(props.game.shopUri);
    const first_played = props.game.firstPlayedAt ? new Date(props.game.firstPlayedAt * 1000) : null;

    return <View style={styles.game}>
        <Image source={{uri: props.game.imageUri, width: 80, height: 80}} style={styles.gameIcon} />

        <View style={styles.gameDetail}>
            <Text style={[styles.gameName, theme.text]}>{props.game.name}</Text>
            {props.game.sysDescription ? <Text style={[styles.gameActivity, theme.text]}>{props.game.sysDescription}</Text> : null}
            <Text style={[styles.gameTotalPlayTime, theme.text]}>Played for {hrduration(props.game.totalPlayTime)}</Text>
            <Text style={[styles.gameFirstPlayed, theme.text]}>First played {first_played?.toLocaleString('en-GB') ?? 'now'}</Text>
            {titleid ? <Text style={[styles.gameTitleId, theme.text]}>Title ID: <Text style={styles.gameTitleIdValue}>{titleid}</Text></Text> : null}
        </View>
    </View>;
}

const styles = StyleSheet.create({
    main: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
    },

    friend: {
        marginRight: 20,
        width: 130,
    },
    friendImage: {
        marginBottom: 14,
    },
    friendName: {
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
    },
    noPresence: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 12,
        opacity: 0.7,
    },

    right: {
        flex: 1,
    },
    detail: {
        flex: 1,
    },

    buttons: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },

    presenceText: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 12,
    },
    presenceTextOnline: {
        color: TEXT_COLOUR_ACTIVE,
    },
    presenceTextOffline: {
        opacity: 0.7,
    },

    game: {
        marginBottom: 20,
        flexDirection: 'row',
    },
    gameIcon: {
        marginRight: 15,
    },
    gameDetail: {
        flex: 1,
    },
    gameName: {
        fontSize: 16,
        fontWeight: '400',
        userSelect: 'text',
    },
    gameActivity: {
        marginTop: 5,
        fontSize: 13,
        userSelect: 'text',
    },
    gameTotalPlayTime: {
        marginTop: 5,
        fontSize: 13,
    },
    gameFirstPlayed: {
        marginTop: 2,
        fontSize: 13,
    },
    gameTitleId: {
        marginTop: 5,
        fontSize: 13,
    },
    gameTitleIdValue: {
        fontFamily: 'monospace',
        userSelect: 'all',
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
