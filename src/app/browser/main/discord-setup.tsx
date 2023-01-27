import React, { useCallback, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import ipc, { events } from '../ipc.js';
import { getAccounts, RequestState, useAccentColour, useAsync, useColourScheme, useDiscordPresenceSource, useEventListener, User } from '../util.js';
import { Friend, PresencePermissions } from '../../../api/coral-types.js';
import { TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import Section from './section.js';
import { Button, NintendoSwitchUser, NintendoSwitchUsers } from '../components/index.js';

export default function SetupDiscordPresence(props: {
    user: User;
    friends: Friend[] | null;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('main_window', { keyPrefix: 'discord_section' });

    const [source, discord_presence_source_state] = useDiscordPresenceSource();

    const [users, ,, forceRefreshAccounts] = useAsync(useCallback(() => getAccounts(), [ipc]));
    useEventListener(events, 'update-nintendo-accounts', forceRefreshAccounts, []);

    const added_friends = useMemo(() => users?.filter(u => u.nso && props.friends?.find(f => {
        if (f.nsaId !== u.nso?.nsoAccount.user.nsaId) return false;

        return props.user.nso!.nsoAccount.user.permissions.presence === PresencePermissions.FRIENDS ||
            (props.user.nso!.nsoAccount.user.permissions.presence === PresencePermissions.FAVORITE_FRIENDS &&
                f.isFavoriteFriend);
    })), [users, props.friends]);

    const auth_user = source && 'na_id' in source ? users?.find(u => u.user.id === source.na_id)?.nso : null;
    const friend = source && 'na_id' in source && source.na_id === props.user.user.id && source.friend_nsa_id ?
        props.friends?.find(f => f.nsaId === source.friend_nsa_id) : null;

    if (!props.friends || discord_presence_source_state !== RequestState.LOADED || !users) return null;

    const content = !source && added_friends?.length ? <>
        <Text style={[styles.text, theme.text]}>
            <Trans i18nKey="main_window:discord_section.setup_with_existing_user">
                <NintendoSwitchUsers users={added_friends.map(u => ({
                    user: u.nso!.nsoAccount.user, nickname: u.user.nickname,
                }))} />
            </Trans>
        </Text>

        <View style={styles.button}>
            <Button title={t('setup')} onPress={() => ipc.showDiscordModal({
                users: added_friends.map(u => u.user.id),
                friend_nsa_id: props.user.nso!.nsoAccount.user.nsaId,
            })} color={'#' + accent_colour} />
        </View>
    </> :!source && users ? <>
        <Text style={[styles.text, theme.text]}>{t('add_user')}</Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && !source.friend_nsa_id ? <>
        <Text style={[styles.text, theme.text]}>{t('active_self')}</Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && friend ? <>
        <Text style={[styles.text, theme.text]}>
            <Trans i18nKey="main_window:discord_section.active_friend">
                <NintendoSwitchUser friend={friend} />
            </Trans>
        </Text>
    </> : source && 'na_id' in source && source.na_id === props.user.user.id && source.friend_nsa_id ? <>
        <Text style={[styles.text, theme.text]}>{t('active_unknown')}</Text>
    </> : source && 'na_id' in source && auth_user && source.friend_nsa_id && source.friend_nsa_id === props.user.nso?.nsoAccount.user.nsaId ? <>
        <Text style={[styles.text, theme.text]}>
            <Trans i18nKey="main_window:discord_section.active_via">
                <NintendoSwitchUser user={auth_user.nsoAccount.user} nickname={auth_user.user.nickname} />
            </Trans>
        </Text>
    </> : null;

    return content ? <Section title={t('title')}>
        <View style={styles.content}>
            {content}

            {source ? <View style={styles.button}>
                <Button title={t('disable')}
                    onPress={() => ipc.setDiscordPresenceSource(null)} color={'#' + accent_colour} />
            </View> : null}
        </View>
    </Section> : null;
}

const styles = StyleSheet.create({
    content: {
        marginTop: -4,
        paddingBottom: 16,
        paddingHorizontal: ipc.platform === 'win32' ? 24 : 20,
    },

    text: {
        fontSize: 13,
        opacity: 0.7,
    },

    button: {
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
