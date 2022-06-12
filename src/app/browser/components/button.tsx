import React, { useCallback, useContext, useState } from 'react';
import { Button as NativeButton, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc from '../ipc.js';
import { useAccentColour, useColourScheme, WindowFocusedContext } from '../util.js';

function ButtonMac(props: {
    title: string;
    primary?: boolean;
    color?: string;
    autoFocus?: boolean;
    onPress?: () => void;
}) {
    const styles = styles_mac;

    const window_focused = useContext(WindowFocusedContext);
    const accent_colour = useAccentColour();

    const [hovered, setMouseOver] = useState(false);
    const onMouseOver = useCallback(() => setMouseOver(true), []);
    const onMouseOut = useCallback(() => setMouseOver(false), []);

    const [pressed, setPressIn] = useState(false);
    const onPressIn = useCallback(() => setPressIn(true), []);
    const onPressOut = useCallback(() => setPressIn(false), []);
    
    const pressed_appearance = window_focused && pressed && hovered;
    const active = window_focused && (props.primary || pressed_appearance);

    return <Pressable
        style={[
            styles.button,
            active ? {backgroundColor: props.color ?? accent_colour} : null,
        ]}
        // @ts-expect-error react-native-web
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onPress={props.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
    >
        <View style={[
            styles.inner,
            active ? styles.innerActive : null,
            active && pressed_appearance ? styles.innerPressed : null,
        ]}>
            <Text style={styles.text}>{props.title}</Text>
        </View>
    </Pressable>;
}

const styles_mac = StyleSheet.create({
    button: {
        cursor: 'default',
        lineHeight: 19,
        borderRadius: 3,
        boxShadow: '#00000030 0px 0px 1px',
    },

    inner: {
        paddingHorizontal: 14,
        paddingVertical: 2,
        borderRadius: 3,
        backgroundColor: '#ffffff40',
        borderTopWidth: 0.5,
        borderTopColor: '#ffffff3a',
    },
    innerActive: {
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(0deg, #00000050, #00000040)',
    },
    innerPressed: {
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(0deg, #00000040, #00000020)',
    },

    text: {
        fontSize: 13,
        color: '#eaeaea',
    },
});

function ButtonWindows(props: {
    title: string;
    primary?: boolean;
    color?: string;
    autoFocus?: boolean;
    onPress?: () => void;
}) {
    const styles = styles_windows;

    const window_focused = useContext(WindowFocusedContext);
    const colour_scheme = useColourScheme();
    const accent_colour = useAccentColour();

    const [hovered, setMouseOver] = useState(false);
    const onMouseOver = useCallback(() => setMouseOver(true), []);
    const onMouseOut = useCallback(() => setMouseOver(false), []);

    const [pressed, setPressIn] = useState(false);
    const onPressIn = useCallback(() => setPressIn(true), []);
    const onPressOut = useCallback(() => setPressIn(false), []);

    const active = window_focused && (props.primary || pressed);

    return <Pressable
        style={[
            styles.button,
            colour_scheme === 'light' ? styles.buttonLight : null,
            window_focused && hovered ? styles.buttonHover : null,
            colour_scheme === 'light' && window_focused && hovered ? styles.buttonLightHover : null,
            active ? {backgroundColor: props.color ?? accent_colour} : null,
        ]}
        // @ts-expect-error react-native-web
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onPress={props.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
    >
        <Text style={[
            styles.text,
            colour_scheme === 'light' && !active ? styles.textLight : null,
        ]}>{props.title}</Text>
    </Pressable>;
}

const styles_windows = StyleSheet.create({
    button: {
        backgroundColor: '#ffffff20',
        minWidth: 180,
        paddingVertical: 8,
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
    },
    buttonLight: {
        backgroundColor: '#00000020',
    },
    buttonHover: {
        backgroundColor: '#ffffff30',
    },
    buttonLightHover: {
        backgroundColor: '#00000030',
    },

    text: {
        color: '#eaeaea',
    },
    textLight: {
        color: TEXT_COLOUR_LIGHT,
    },
});

function ButtonNative(props: {
    title: string;
    color?: string;
    onPress?: () => void;
}) {
    const accent_colour = useAccentColour();

    return <NativeButton
        title={props.title}
        color={props.color ?? accent_colour}
        onPress={props.onPress}
    />;
}

export default
    Platform.OS === 'web' && ipc.platform === 'darwin' ? React.memo(ButtonMac) :
    Platform.OS === 'web' && ipc.platform === 'win32' ? React.memo(ButtonWindows) :
    React.memo(ButtonNative);
