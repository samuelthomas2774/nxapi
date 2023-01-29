import createDebug from 'debug';
import { BackendModule, CallbackError, createInstance, ReadCallback } from 'i18next';

const debug = createDebug('app:i18n');

export const languages = {
    'en-GB': [() => import('./locale/en-gb.js'), 'English'] as const,
    'de-DE': [() => import('./locale/de-de.js'), 'Deutsch'] as const,
};

type Namespace = keyof typeof import('./locale/en-gb.js');

export default function createI18n() {
    const i18n = createInstance({
        fallbackLng: 'en-GB',
        debug: true,
        supportedLngs: Object.keys(languages),
        load: 'currentOnly',
        returnNull: false,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        react: {
            useSuspense: false,
        },
    });

    i18n.use(LanguageBackend);

    return i18n;
}

const LanguageBackend: BackendModule = {
    type: 'backend',
    read: (
        language: keyof typeof languages,
        namespace: Namespace,
        callback: ReadCallback,
    ) => {
        debug('Loading %s translations for %s', namespace, language);

        importLocale(language).then(resources => {
            callback(null, resources[namespace as keyof typeof resources]);
        }, (error: CallbackError) => {
            callback(error, null);
        });
    },
    init: null as any,
};

async function importLocale(language: keyof typeof languages) {
    if (!(language in languages)) throw new Error('Unknown language ' + language);

    return languages[language][0]();
}
