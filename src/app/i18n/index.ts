import createDebug from 'debug';
import { BackendModule, CallbackError, createInstance, ReadCallback } from 'i18next';

const debug = createDebug('app:i18n');

import './locale/en-gb.js';

export const languages = {
    'en-GB': {
        name: 'English',
        app: () => import('./locale/en-gb.js'),
        authors: [
            ['Ellie', 'https://gitlab.fancy.org.uk/ellie'],
        ],
    },
    'de-DE': {
        name: 'Deutsch',
        app: () => import('./locale/de-de.js'),
        authors: [
            ['Inkception', 'https://github.com/Inkception'],
        ],
    },
    'es-ES': {
        name: 'Español',
        app: () => import('./locale/es-es.js'),
        authors: [
            ['sarayalth', 'https://github.com/sarayalth'],
        ],
    },
    'ja-JP': {
        name: 'Japanese',
        app: () => import('./locale/ja-jp.js'),
        authors: [
            ['hilot06', 'https://github.com/hilot06'],
        ],
    },
    'zh-CN': {
        name: '中文（简体）',
        app: () => import('./locale/zh-cn.js'),
        authors: [
            ['Ray Lin', 'https://github.com/lin010151'],
        ],
    },
};

const namespaces = {
    app: 'app',
    app_menu: 'app',
    menu_app: 'app',
    menus: 'app',
    notifications: 'app',
    handle_uri: 'app',

    main_window: 'app',
    preferences_window: 'app',
    friend_window: 'app',
    addfriend_window: 'app',
    discordsetup_window: 'app',
    addaccountmanual_window: 'app',
} as const;

type Namespace = keyof typeof namespaces;

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

        importLocale(language, namespaces[namespace]).then(resources => {
            callback(null, resources[namespace as keyof typeof resources]);
        }, (error: CallbackError) => {
            callback(error, null);
        });
    },
    init: null as any,
};

async function importLocale(
    language: keyof typeof languages,
    chunk: typeof namespaces[keyof typeof namespaces] = 'app',
) {
    if (!(language in languages)) throw new Error('Unknown language ' + language);

    return languages[language][chunk]();
}
