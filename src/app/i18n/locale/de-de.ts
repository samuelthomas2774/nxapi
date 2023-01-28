import { CREDITS_NOTICE, LICENCE_NOTICE } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch Online',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
};

export const app_menu = {
    preferences: 'Einstellungen',
    view: 'Anschauen',
    learn_more: 'Mehr erfahren',
    learn_more_github: 'Mehr erfahren (GitHub)',
    search_issues: 'Probleme untersuchen',

    refresh: 'Refresh',
};

export const menu_app = {
    coral_heading: 'Nintendo Switch Online',
    na_id: 'Nintendo Account ID: {{id}}',
    coral_id: 'Coral ID: {{id}}',
    nsa_id: 'NSA ID: {{id}}',
    discord_presence_enable: 'Discord Rich Presence aktivieren',
    user_notifications_enable: 'Aktiviere Benachrichtigungen für diesen User',
    friend_notifications_enable: 'Aktiviere Benachrichtigungen für Freunde von diesen User',
    refresh: 'Jetzt aktualisieren',
    add_friend: 'Freund hinzufügen',
    web_services: 'Web-Services',

    moon_heading: 'Nintendo Switch Parental Controls',

    add_account: 'Account hinzufügen',

    show_main_window: 'Zeige Hauptfenster',
    preferences: 'Einstellungen',
    quit: 'Beenden',
};

export const menus = {
    add_account: {
        add_account_coral: 'Nintendo Switch Online Account hinzufügen',
        add_account_moon: 'Altersbeschränkter Nintendo Switch Account hinzufügen',
    },

    friend_code: {
        share: 'Teilen',
        copy: 'Kopieren',
        friend_code_regenerable: 'Regeneriere durch Nintendo Switch Konsole',
        friend_code_regenerable_at: 'Kann {{date, datetime}} neu generiert werden',
    },

    user: {
        na_id: 'Nintendo Account ID: {{id}}',
        coral_id: 'Coral ID: {{id}}',
        nsa_id: 'NSA ID: {{id}}',
        discord_disable: 'Deaktiviere Discord Rich Presence',
        discord_enabled_for: 'Discord Rich Presence für {{name}} aktiviert',
        discord_enabled_via: 'Discord Rich Presence durch {{name}} aktiviert',
        discord_enable: 'Aktiviere Discord Rich Presence für diesen User...',
        friend_notifications_enable: 'Aktiviere Freund-Benachrichtigungen',
        refresh: 'Jetzt aktualisieren',
        add_friend: 'Freund hinzufügen',
        remove_help: 'Benutze den nxapi Befehl, um diesen User zu entfernen',
    },

    friend: {
        presence_online: 'Online',
        game_first_played: 'Zuerst gespielt: {{date, datetime}}',
        game_play_time: 'Spielzeit: {{time, datetime}}',
        presence_inactive: 'Offline (console online)',
        presence_offline: 'Offline',
        presence_updated: 'Aktualisiert: {{date, datetime}}',
        presence_logout_time: 'Ausgeloggt: {{date, datetime}}',
        discord_presence_enable: 'Aktiviere Discord Rich Presence',
    },
};

export const notifications = {
    playing: 'Spielt {{name}}',
    offline: 'Offline',
};

export const handle_uri = {
    friend_code_select: 'Wähle einen User aus, um Freunde hinzuzufügen',
    web_service_select: 'Wähle einen User aus, um diesen Service zu öffnen',
    web_service_invalid_title: 'Unbekannter Titel',
    web_service_invalid_detail: 'The URL did not reference an existing web service.',
    cancel: 'Abbrechen',
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presence aktiv',
        discord_active_friend: 'Discord Rich Presence aktiv: <0></0>',
        discord_not_active: 'Discord Rich Presence nicht aktiv',
        discord_playing: 'Spielt',

        add_user: 'User hinzufügen',
        discord_setup: 'Discord Rich Presence einrichten',

        enable_auto_refresh: 'Automatisches aktualisieren',
    },

    update: {
        update_available: 'Update verfügbar: {{name}}',
        download: 'Download',
        error: 'Fehler beim Überprüfen von Updates aufgetreten: {{message}}',
        retry: 'Erneut versuchen',
    },

    main_section: {
        error: {
            title: 'Fehler beim Laden der Daten',
            message: 'Ein Fehler ist beim Laden der {{errors, list}} Daten aufgetreten.',
            message_friends: 'freunde',
            message_webservices: 'spiel-spezifische services',
            message_event: 'sprachchat',
            retry: 'Erneut versuchen',
            view_details: 'Details anschauen',
        },

        moon_only_user: {
            title: 'Nintendo Switch Online',
            desc_1: 'Dieser User ist mit der Nintendo Switch-Altersbeschränkungen App angemeldet, aber nicht mit der Nintendo Switch Online App.',
            desc_2: 'Logge dich mit der Nintendo Switch Online App ein, um Details einzusehen oder benutze den nxapi Befehl, um auf Altersbeschränkungen zuzugreifen.',
            login: 'Login',
        },
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: 'Benutze einer dieser Account, um die Discord Rich Presence einzurichten: <0></0>.',
        add_user: 'Füge einen Nintendo Switch Online Account mit diesem User als Freund hinzu, um die Discord Rich Presence einzurichten.',
        active_self: 'Die Presence wird mit diesem User auf Discord geteilt.',
        active_friend: '<0></0>\'s Presence wird mit diesem Account auf Discord geteilt.',
        active_unknown: 'Die Presence eines unbekannten Users wird mit Discord geteilt.',
        active_via: 'Die Presence wird mit diesem User auf Discord über <0></0> geteilt.',

        setup: 'Einrichten',
        disable: 'Deaktivieren',
    },

    friends_section: {
        title: 'Freunde',

        no_friends: 'Füge Freunde mit deiner Nintendo Switch Konsole hinzu.',
        friend_code: 'Dein Freundescode',

        presence_playing: 'Spielt',
        presence_offline: 'Offline',
    },

    webservices_section: {
        title: 'Spiel-spezifische Services',
    },

    event_section: {
        title: 'Sprachchat',

        members: '{{event}} im Spiel, {{voip}} im Sprachchat',
        members_with_total: '{{event}} im Spiel, {{voip}} von {{total}} im Sprachkanal',

        app_start: 'Benutze die Nintendo Switch Online App auf iOS oder Android, um einen Sprachchat zu starten.',
        app_join: 'Benutze die Nintendo Switch Online App auf iOS oder Android, um einem Sprachchat beizutreten.',

        share: 'Teilen',
    },
};

export const preferences_window = {
    title: 'Einstellungen',

    startup: {
        heading: 'Start',
        login: 'Öffne beim Start',
        background: 'Öffne im Hintergrund',
    },

    sleep: {
        heading: 'Sleep',
    },

    discord: {
        heading: 'Discord Rich Presence',
        enabled: 'Discord Rich Presence ist aktiviert.',
        disabled: 'Discord Rich Presence ist deaktiviert.',
        setup: 'Discord Rich Presence setup',

        user: 'Discord user',
        user_any: 'Zuerst gesehen',

        friend_code: 'Freundescode',
        friend_code_help: 'Wenn du deinen Freundescode hinzufügst, wird ebenfalls dein User Icon in Discord angezeigt.',
        friend_code_self: 'Teile meinen Freundescode',
        friend_code_custom: 'Eigenen Freundescode festlegen',

        inactive_presence: 'Zeige inaktive Presence',
        inactive_presence_help: 'Zeigt "Spielt nicht" wenn eine verbundene Konsole online ist, du aber nicht spielst.',

        play_time: 'Spielzeit',
        play_time_hidden: 'Spielzeit niemals anzeigen',
        play_time_nintendo: 'Zeige Spielzeit wie sie auf der Nintendo Switch Konsole angezeigt wird',
        play_time_approximate_play_time: 'Zeige ungefähre Spielzeit an (nächste 5 Stunden)',
        play_time_approximate_play_time_since: 'Zeige ungefähre Spielzeit (nächste 5 Stunden) mit erstem Startdatum',
        play_time_hour_play_time: 'Zeige ungefähre Spielzeit (nächste Stunde)',
        play_time_hour_play_time_since: 'Zeige ungefähre Spielzeit (nächste Stunde) mit erstem Startdatum',
        play_time_detailed_play_time: 'Zeige exakte Spielzeit',
        play_time_detailed_play_time_since: 'Zeige exakte Spielzeit mit erstem Startdatum',
    },

    splatnet3: {
        heading: 'SplatNet 3',
        discord: 'Aktiviere erweiterte Discord Rich Presence für Splatoon 3',
        discord_help_1: 'Benutzt SplatNet 3, um zusätzliche Informationen anzuzeigen, während du Splatoon 3 spielst. Du musst einen zweiten Nintendo Switch Account hinzufügen, welcher mit deinem Hauptaccount befreundet ist und Zugriff auf SplatNet 3 hat.',
        discord_help_2: 'Wenn du eine Presence URL benutzt, werden die zusätzlichen Informationen angezeigt, ohne diese Einstellung zu berücksichtigen.',
    },
};

export const friend_window = {
    no_presence: 'Du hast keinen Zugriff auf die Presence von diesem User oder es war nie online.',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Hat nie die Nintendo Switch Online App genutzt',

    friends_since: 'Freunde seit: {{date, datetime}}',
    presence_updated_at: 'Presence aktualisiert: {{date, datetime}}',
    presence_logout_at: 'Zuletzt online: {{date, datetime}}',

    presence_sharing: 'Dieser User kann deine Presence sehen.',
    presence_not_sharing: 'Dieser User kann deine Presence nicht sehen.',

    discord_presence: 'Presence auf Discord teilen',
    close: 'Schließen',

    presence_playing: 'Spielt {{game}}',
    presence_offline: 'Offline',
    presence_last_seen: 'Zuletzt gesehen: {{since_logout}}',

    game_played_for: 'Gespielt für {{duration}}',
    game_first_played: 'Zuerst gespielt {{date, datetime}}',
    game_first_played_now: 'Zuerst gespielt jetzt',
    game_title_id: 'Titel ID',
    game_shop: 'Nintendo eShop',
};

export const addfriend_window = {
    title: 'Add friend',
    help: 'Type or paste a friend code or friend code URL to send a friend request.',

    lookup_error: 'Error looking up friend code: {{message}}',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Never used the Nintendo Switch Online app',

    send_added: 'You are now friends with this user.',
    send_sent: 'Friend request sent. {{user}} can accept your friend request using a Nintendo Switch console, or by sending you a friend request using the Nintendo Switch Online app or nxapi.',
    send_sending: 'Sending friend request...',
    send_error: 'Error sending friend request: {{message}}',

    already_friends: 'You are already friends with this user.',

    close: 'Close',
    send: 'Send friend request',
};

export const discordsetup_window = {
    title: 'Discord Rich Presence setup',

    mode_heading: '1. Select mode',
    mode_coral_friend: 'Select a user that is friends with the user you want to share',
    mode_url: 'Enter a URL that returns the presence data you want to share',
    mode_none: 'Disable',

    coral_user_heading: '2. Select user',
    coral_user_help: 'This user must be friends with the user you want to share.',
    coral_friend_heading: '3. Select friend',
    coral_friend_help: 'This is the user you want to share.',

    url_heading: '2. Enter presence URL',
    url_help: 'This must be a HTTPS URL that returns a JSON object with either a user, friend or presence key. This is intended to be used with nxapi\'s znc API proxy.',

    preferences_heading: 'Configure additional options for Discord Rich Presence',
    preferences: 'Preferences',

    cancel: 'Cancel',
    save: 'Save',
};

export const addaccountmanual_window = {
    title: 'Add account',

    authorise_heading: '1. Login to your Nintendo Account',
    authorise_help: 'Do not select an account yet.',
    authorise_open: 'Open Nintendo Account authorisation',

    response_heading: '2. Enter the callback link',
    response_help_1: 'On the "Linking an External Account" page, right click "Select this person" and copy the link. It should start with "{{url}}".',
    response_help_2: 'If you are adding a child account linked to your account, click "Select this person" next to their account to sign in as the child account, then with only the child account showing right click "Select this person" and copy the link.',

    cancel: 'Cancel',
    save: 'Add account',
};
