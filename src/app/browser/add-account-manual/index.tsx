import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { Root, useEventListener } from '../util.js';

export interface AddAccountManualPromptProps {
    authoriseurl: string;
    client_id: string;
}

export default function AddAccountManualPrompt(props: AddAccountManualPromptProps) {
    const colour_scheme = useColorScheme();
    const theme = colour_scheme === 'light' ? light : dark;

    const [accent_colour, setAccentColour] = React.useState(() => ipc.getAccentColour());
    useEventListener(events, 'systemPreferences:accent-colour', setAccentColour, []);

    useEventListener(events, 'window:refresh', () => true, []);

    const [callback_url, setCallbackUrl] = useState('');
    const callback_url_valid = callback_url.startsWith('npf' + props.client_id + '://auth');

    const save = useCallback(() => {
        if (callback_url_valid) {
            location.href = callback_url;
        }
    }, [callback_url, callback_url_valid]);

    return <Root title="Add account" scrollable autoresize>
        <View style={styles.main}>
            <Text style={theme.text}>1. Login to your Nintendo Account</Text>
            <Text style={[styles.help, theme.text]}>Do not select an account yet.</Text>

            <View style={styles.buttonSingle}>
                <Button title="Open Nintendo Account authorisation"
                    onPress={() => ipc.openExternalUrl(props.authoriseurl)}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>

            <Text style={[styles.header, theme.text]}>2. Enter the callback link</Text>
            <Text style={[styles.help, theme.text]}>On the "Linking an External Account" page, right click "Select this person" and copy the link. It should start with "npf{props.client_id}://auth".</Text>
            <Text style={[styles.help, theme.text]}>If you are adding a child account linked to your account, click "Select this person" next to their account to sign in as the child account, then with only the child account showing right click "Select this person" and copy the link.</Text>

            <TextInput value={callback_url} onChangeText={setCallbackUrl}
                placeholder={'npf' + props.client_id + '://auth#...'}
                style={[styles.textInput, theme.textInput]} />

            <View style={styles.buttons}>
                <View style={styles.button}>
                    <Button title="Cancel"
                        onPress={() => window.close()}
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View>
                {callback_url_valid ? <View style={styles.button}>
                    <Button title="Add account"
                        onPress={save}
                        primary
                        color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
                </View> : null}
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
    buttonSingle: {
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
