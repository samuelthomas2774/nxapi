import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { CurrentUser } from '../../../api/coral-types.js';
import ipc from '../ipc.js';

export default function FriendCode(props: {
    friendcode: CurrentUser['links']['friendCode'];
} | {
    id: string;
}) {
    const friendcode = useMemo(() => 'friendcode' in props ? props.friendcode : {
        id: props.id,
        regenerable: false,
        regenerableAt: 0,
    }, ['friendcode' in props ? props.friendcode : null, 'id' in props ? props.id : null]);

    const onFriendCodeContextMenu = useCallback(() => {
        ipc.showFriendCodeMenu(friendcode);
    }, [ipc, friendcode]);

    return <Text
        style={styles.friendCodeValue}
        // @ts-expect-error react-native-web
        onContextMenu={onFriendCodeContextMenu}
    >SW-{friendcode.id}</Text>;
}

const styles = StyleSheet.create({
    friendCodeValue: {
        // @ts-expect-error
        userSelect: 'all',
    },
});
