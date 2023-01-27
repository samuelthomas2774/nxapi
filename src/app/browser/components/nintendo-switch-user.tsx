import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { CurrentUser, Friend } from '../../../api/coral-types.js';

export default function NintendoSwitchUser(props: {
    friend: Friend;
    nickname?: string;
} | {
    user: CurrentUser;
    nickname?: string;
}) {
    const user = 'friend' in props ? props.friend : props.user;

    return <>
        <Image source={{uri: user.imageUri, width: 16, height: 16}}
            style={styles.userImage} />
        {' '}
        {user.name}
        {props.nickname && user.name !== props.nickname ? ' (' + props.nickname + ')' : ''}
    </>;
}

export function NintendoSwitchUsers(props: {
    users: Parameters<typeof NintendoSwitchUser>[0][];
}) {
    return <>
        {props.users.map((u, i) => <React.Fragment key={'friend' in u ? u.friend.nsaId : u.user.nsaId}>
            {i === 0 ? '' : ', '}
            <NintendoSwitchUser {...u} />
        </React.Fragment>)}
    </>;
}

const styles = StyleSheet.create({
    userImage: {
        borderRadius: 8,
        textAlignVertical: -3,
    },
});
