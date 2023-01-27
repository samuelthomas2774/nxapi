/// <reference path="../react-native-web.d.ts" />

import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckBox } from 'react-native-web';
import { Friend, Game, Presence, PresencePermissions, PresenceState } from '../../../api/coral-types.js';
import { getTitleIdFromEcUrl, hrduration } from '../../../util/misc.js';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, TEXT_COLOUR_ACTIVE, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { RequestState, Root, useAccentColour, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener, useTimeSince } from '../util.js';

export interface FriendProps {
    user: string;
    friend: string;
}

export default function FriendWindow(props: FriendProps) {
    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    const [discord_presence_source, discord_presence_source_state] = useDiscordPresenceSource();

    const [token] = useAsync(useCallback(() => ipc.getNintendoAccountCoralToken(props.user), [ipc, props.user]));
    const [user] = useAsync(useCallback(() => token ?
        ipc.getSavedCoralToken(token) : Promise.resolve(null), [ipc, token]));
    const [friends, , friends_state, forceRefreshFriends] = useAsync(useCallback(() => token ?
        ipc.getNsoFriends(token) : Promise.resolve(null), [ipc, token]));
    const friend = friends?.find(f => f.nsaId === props.friend);

    useEffect(() => {
        if (friends_state !== RequestState.LOADED) return;
        const timeout = setTimeout(forceRefreshFriends, 40 * 1000);
        return () => clearTimeout(timeout);
    }, [ipc, token, friends_state]);

    useEventListener(events, 'window:refresh', forceRefreshFriends, []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => event.key === 'Escape' && window.close();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (friends && !friend) throw new Error('Unknown friend');

    if (!user || !friend || discord_presence_source_state !== RequestState.LOADED) {
        return <Root title={friend?.name} titleUser={user ?? undefined}
            autoresize={!!user && discord_presence_source_state === RequestState.LOADED}
            i18nNamespace="friend_window"
        >
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
        </Root>;
    }

    const discord_presence_active = discord_presence_source && 'na_id' in discord_presence_source &&
        discord_presence_source.na_id === user.user.id &&
        discord_presence_source.friend_nsa_id === friend.nsaId;
    const can_see_user_presence = user.nsoAccount.user.permissions.presence === PresencePermissions.FRIENDS ||
        (user.nsoAccount.user.permissions.presence === PresencePermissions.FAVORITE_FRIENDS && friend.isFavoriteFriend);

    return <Root title={friend.name} titleUser={user} autoresize i18nNamespace="friend_window">
        <Friend
            friend={friend} canSeeUserPresence={can_see_user_presence}
            showDiscordPresenceSetup={discord_presence_active || !!friend.presence.updatedAt || false}
            discordPresenceActive={discord_presence_active ?? false}
            setDiscordPresenceActive={active => ipc.setDiscordPresenceSource(active ?
                {na_id: user.user.id, friend_nsa_id: friend.nsaId} : null)} />
    </Root>;
}

function Friend(props: {
    friend: Friend;
    canSeeUserPresence?: boolean;
    showDiscordPresenceSetup?: boolean;
    discordPresenceActive?: boolean;
    setDiscordPresenceActive?: (active: boolean) => void;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('friend_window');

    const friend = props.friend;

    return <View style={styles.main}>
        <View style={styles.friend}>
            <Image source={{uri: friend.imageUri, width: 130, height: 130}} style={styles.friendImage} />
            <Text style={[styles.friendName, theme.text]}>{friend.name}</Text>

            {friend.presence.updatedAt ?
                <FriendPresence presence={friend.presence} /> :
                <Text style={[styles.noPresence, theme.text]}>{t('no_presence')}</Text>}
        </View>

        <View style={styles.right}>
            <View style={styles.detail}>
                {(friend.presence.state === PresenceState.ONLINE || friend.presence.state === PresenceState.PLAYING) &&
                    'name' in friend.presence.game ? <FriendPresenceGame game={friend.presence.game} /> : null}

                <Text style={[styles.friendNsaId, theme.text]}>
                    {t('nsa_id')}: <Text style={styles.friendNsaIdValue}>{friend.nsaId}</Text>
                </Text>
                <Text style={[styles.friendCoralId, theme.text]}>{friend.isServiceUser ? <>
                    {t('coral_id')}: <Text style={styles.friendCoralIdValue}>{friend.id}</Text>
                </> : t('no_coral_user')}</Text>

                <Text style={[styles.friendCreatedAt, theme.text]}>
                    {t('friends_since', {
                        date: new Date(friend.friendCreatedAt * 1000),
                        formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                    })}
                </Text>
                {friend.presence.updatedAt ? <Text style={[styles.presenceUpdatedAt, theme.text]}>
                    {t('presence_updated_at', {
                        date: new Date(friend.presence.updatedAt * 1000),
                        formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                    })}
                </Text> : null}
                {!(friend.presence.state === PresenceState.ONLINE || friend.presence.state === PresenceState.PLAYING) &&
                    friend.presence.logoutAt ? <Text style={[styles.presenceUpdatedAt, theme.text]}>
                        {t('presence_logout_at', {
                            date: new Date(friend.presence.logoutAt * 1000),
                            formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                        })}
                    </Text> : null}
                <Text style={[styles.canSeeUserPresence, theme.text]}>
                    {t(props.canSeeUserPresence ? 'presence_sharing' : 'presence_not_sharing')}
                </Text>
            </View>

            <View style={styles.buttons}>
                {props.showDiscordPresenceSetup ? <View style={styles.discord}>
                    <CheckBox
                        value={props.discordPresenceActive ?? false}
                        onValueChange={v => props.setDiscordPresenceActive?.(!!v)}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                        style={styles.discordCheckbox}
                    />
                    <TouchableOpacity onPress={() => props.setDiscordPresenceActive?.(!props.discordPresenceActive)}>
                        <Text style={theme.text}>{t('discord_presence')}</Text>
                    </TouchableOpacity>
                </View> : null}

                <Button title={t('close')}
                    onPress={() => window.close()}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)}
                    primary autoFocus />
            </View>
        </View>
    </View>;
}

function FriendPresence(props: {
    presence: Presence;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const { t, i18n } = useTranslation('friend_window');

    const logout = props.presence.logoutAt ? new Date(props.presence.logoutAt * 1000) : null;
    const since_logout = useTimeSince(logout ?? new Date(0));
    const game = 'name' in props.presence.game ? props.presence.game : null;

    if ((props.presence.state === PresenceState.ONLINE || props.presence.state === PresenceState.PLAYING) && game) {
        return <Text style={[styles.presenceText, theme.text, styles.presenceTextOnline]}>{t('presence_playing', {game: game.name})}</Text>;
    }

    return <View>
        <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>{t('presence_offline')}</Text>
        {logout ? <Text style={[styles.presenceText, styles.presenceTextOffline, theme.text]}>{t('presence_last_seen', {since_logout})}</Text> : null}
    </View>;
}

function FriendPresenceGame(props: {
    game: Game;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('friend_window');

    const openShop = useCallback(() => {
        ipc.openExternalUrl(props.game.shopUri);
    }, [ipc, props.game.shopUri]);

    const titleid = getTitleIdFromEcUrl(props.game.shopUri);
    const first_played = props.game.firstPlayedAt ? new Date(props.game.firstPlayedAt * 1000) : null;

    return <View style={styles.game}>
        <Image source={{uri: props.game.imageUri, width: 80, height: 80}} style={styles.gameIcon} />

        <View style={styles.gameDetail}>
            <Text style={[styles.gameName, theme.text]}>{props.game.name}</Text>
            {props.game.sysDescription ? <Text style={[styles.gameActivity, theme.text]}>{props.game.sysDescription}</Text> : null}
            <Text style={[styles.gameTotalPlayTime, theme.text]}>
                {t('game_played_for', {duration: hrduration(props.game.totalPlayTime)})}
            </Text>
            <Text style={[styles.gameFirstPlayed, theme.text]}>
                {first_played ? t('game_first_played', {
                    date: first_played,
                    formatParams: { date: { dateStyle: 'short', timeStyle: 'medium' } },
                }) : t('game_first_played_now')}
            </Text>
            {titleid ? <Text style={[styles.gameTitleId, theme.text]}>
                {t('game_title_id')}: <Text style={styles.gameTitleIdValue}>{titleid}</Text>
            </Text> : null}

            <View style={styles.gameShopButton}>
                <Button title={t('game_shop')} onPress={openShop} color={'#' + accent_colour} />
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

    friendNsaId: {
        fontSize: 13,
        opacity: 0.7,
    },
    friendNsaIdValue: {
        fontFamily: 'monospace',
        userSelect: 'all',
    },
    friendCoralId: {
        fontSize: 13,
        opacity: 0.7,
    },
    friendCoralIdValue: {
        fontFamily: 'monospace',
        userSelect: 'all',
    },
    friendCreatedAt: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
    },
    presenceUpdatedAt: {
        fontSize: 13,
        opacity: 0.7,
    },
    canSeeUserPresence: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
    },

    buttons: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    discord: {
        flex: 1,
        marginRight: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discordCheckbox: {
        marginRight: 10,
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
        marginBottom: 15,
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
    gameShopButton: {
        marginTop: 10,
        flexDirection: 'row',
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
