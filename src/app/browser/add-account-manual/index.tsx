import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/index.js';
import { DEFAULT_ACCENT_COLOUR, HIGHLIGHT_COLOUR_DARK, HIGHLIGHT_COLOUR_LIGHT, TEXT_COLOUR_DARK, TEXT_COLOUR_LIGHT } from '../constants.js';
import ipc, { events } from '../ipc.js';
import { Root, useAccentColour, useColourScheme, useEventListener } from '../util.js';

export interface AddAccountManualPromptProps {
    authoriseurl: string;
    client_id: string;
}

export default function AddAccountManualPromptWindow(props: AddAccountManualPromptProps) {
    useEventListener(events, 'window:refresh', () => true, []);

    const save = useCallback((callback_url: string) => {
        location.href = callback_url;
    }, []);

    return <Root
        title={i18n => i18n.t('addaccountmanual_window:title')} scrollable autoresize
        i18nNamespace="addaccountmanual_window"
    >
        <AddAccountManualPrompt {...props} save={save} />
    </Root>
}

function AddAccountManualPrompt(props: AddAccountManualPromptProps & {
    save?: (callback_url: string) => void;
}) {
    const theme = useColourScheme() === 'light' ? light : dark;
    const accent_colour = useAccentColour();
    const { t, i18n } = useTranslation('addaccountmanual_window');

    const [callback_url, setCallbackUrl] = useState('');
    const callback_url_valid = callback_url.startsWith('npf' + props.client_id + '://auth');

    const save = useCallback(() => {
        if (callback_url_valid) {
            props.save?.call(null, callback_url);
        }
    }, [props.save, callback_url, callback_url_valid]);

    return <View style={styles.main}>
        <Text style={theme.text}>{t('authorise_heading')}</Text>
        <Text style={[styles.help, theme.text]}>{t('authorise_help')}</Text>

        <View style={styles.buttonSingle}>
            <Button title={t('authorise_open')}
                onPress={() => ipc.openExternalUrl(props.authoriseurl)}
                color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
        </View>

        <Text style={[styles.header, theme.text]}>{t('response_heading')}</Text>
        <Text style={[styles.help, theme.text]}>{t('response_help_1', {url: `npf${props.client_id}://auth`})}</Text>
        <Text style={[styles.help, theme.text]}>{t('response_help_2')}</Text>

        <TextInput value={callback_url} onChangeText={setCallbackUrl}
            placeholder={'npf' + props.client_id + '://auth#...'}
            style={[styles.textInput, theme.textInput]} />

        <View style={styles.buttons}>
            <View style={styles.button}>
                <Button title={t('cancel')}
                    onPress={() => window.close()}
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View>
            {callback_url_valid ? <View style={styles.button}>
                <Button title={t('save')}
                    onPress={save}
                    primary
                    color={'#' + (accent_colour ?? DEFAULT_ACCENT_COLOUR)} />
            </View> : null}
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
