import { CREDITS_NOTICE, LICENCE_NOTICE } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch Online',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
    translation_credits: '{{language}} Übersetzungen von {{authors, list}}.',
};

export const app_menu = {
    preferences: 'Einstellungen',
    view: 'Anschauen',
    learn_more: 'Mehr erfahren',
    learn_more_github: 'Mehr erfahren (GitHub)',
    search_issues: 'Probleme untersuchen',

    refresh: 'Aktualisieren',
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

    moon_heading: 'Nintendo Switch-Altersbeschränkungen',

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
        
        game_play_time_h: 'Spielzeit: $t(friend.hours, {"count": {{hours}}})',
        game_play_time_hm: 'Spielzeit: $t(friend.hours, {"count": {{hours}}}), $t(friend.minutes, {"count": {{minutes}}})',
        game_play_time_m: 'Spielzeit: $t(friend.minutes, {"count": {{minutes}}})',
        hours_one: '{{count}} Stunde',
        hours_other: '{{count}} Stunden',
        minutes_one: '{{count}} Minute',
        minutes_other: '{{count}} Minuten',

        presence_inactive: 'Offline (Konsole online)',
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
    web_service_invalid_detail: 'Die angegebene URL verwies nicht auf einen existierenden Web-Service.',
    cancel: 'Abbrechen',
};

export const time_since = {
    default: {
        now: 'jetzt',
        seconds_one: 'Vor {{count}} Sekunde',
        seconds_other: 'Vor {{count}} Sekunden',
        minutes_one: 'Vor {{count}} Minute',
        minutes_other: 'Vor {{count}} Minuten',
        hours_one: 'Vor {{count}} Stunde',
        hours_other: 'Vor {{count}} Stunden',
        days_one: 'Vor {{count}} Tag',
        days_other: 'Vor {{count}} Tagen',
    },

    short: {
        now: 'jetzt',
        seconds_one: '{{count}} Sek',
        seconds_other: '{{count}} Sek',
        minutes_one: '{{count}} Min',
        minutes_other: '{{count}} Min',
        hours_one: '{{count}} Std',
        hours_other: '{{count}} Std',
        days_one: '{{count}} Tg',
        days_other: '{{count}} Tg',
    },
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presence aktiv',
        discord_active_friend: 'Discord Rich Presence aktiv: <0></0>',
        discord_not_active: 'Discord Rich Presence nicht aktiv',
        discord_playing: 'Spielt',

        add_user: 'User hinzufügen',
        discord_setup: 'Discord Rich Presence einrichten',

        enable_auto_refresh: 'Automatisch aktualisieren',
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
            message_webservices: 'spielspezifische services',
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

        section_error: 'Fehler beim Aktualisieren der Daten',
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: 'Benutze einer dieser Account, um die Discord Rich Presence einzurichten: <0></0>.',
        add_user: 'Füge einen Nintendo Switch Online Account mit diesem User als Freund hinzu, um die Discord Rich Presence einzurichten.',
        active_self: 'Die Aktivität wird mit diesem User auf Discord geteilt.',
        active_friend: '<0></0>\'s Aktivität wird mit diesem Account auf Discord geteilt.',
        active_unknown: 'Die Aktivität eines unbekannten Users wird mit Discord geteilt.',
        active_via: 'Die Aktivität wird mit diesem User auf Discord über <0></0> geteilt.',

        setup: 'Einrichten',
        disable: 'Deaktivieren',
    },

    friends_section: {
        title: 'Freunde',

        no_friends: 'Füge Freunde mit deiner Nintendo Switch Konsole hinzu.',
        friend_code: 'Dein Freundescode: <0></0>',

        presence_playing: 'Spielt',
        presence_offline: 'Offline',
    },

    webservices_section: {
        title: 'Spielspezifische Services',
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
        setup: 'Discord Rich Presence Setup',

        user: 'Discord User',
        user_any: 'Zuerst gesehen',

        friend_code: 'Freundescode',
        friend_code_help: 'Wenn du deinen Freundescode hinzufügst, wird ebenfalls dein User Icon in Discord angezeigt.',
        friend_code_self: 'Teile meinen Freundescode',
        friend_code_custom: 'Eigenen Freundescode festlegen',

        inactive_presence: 'Zeige inaktive Aktivität',
        inactive_presence_help: 'Zeigt "Spielt nicht", wenn eine verbundene Konsole online ist, du aber nicht spielst.',

        play_time: 'Spielzeit',
        play_time_hidden: 'Spielzeit niemals anzeigen',
        play_time_nintendo: 'Zeige Spielzeit wie sie auf der Nintendo Switch Konsole angezeigt wird',
        play_time_approximate_play_time: 'Zeige ungefähre Spielzeit (nächste 5 Stunden) an',
        play_time_approximate_play_time_since: 'Zeige ungefähre Spielzeit (nächste 5 Stunden) mit erstem Startdatum an',
        play_time_hour_play_time: 'Zeige ungefähre Spielzeit (nächste Stunde) an',
        play_time_hour_play_time_since: 'Zeige ungefähre Spielzeit (nächste Stunde) mit erstem Startdatum an',
        play_time_detailed_play_time: 'Zeige exakte Spielzeit an',
        play_time_detailed_play_time_since: 'Zeige exakte Spielzeit mit erstem Startdatum an',
    },

    splatnet3: {
        heading: 'SplatNet 3',
        discord: 'Aktiviere die erweiterte Discord Rich Presence für Splatoon 3',
        discord_help_1: 'Benutzt SplatNet 3, um zusätzliche Informationen anzuzeigen, während du Splatoon 3 spielst. Du musst einen zweiten Nintendo Switch Account hinzufügen, welcher mit deinem Hauptaccount befreundet ist und Zugriff auf SplatNet 3 hat.',
        discord_help_2: 'Wenn du eine Presence URL benutzt, werden die zusätzlichen Informationen angezeigt, ohne diese Einstellung zu berücksichtigen.',
    },
};

export const friend_window = {
    no_presence: 'Du hast keinen Zugriff auf die Aktivität von diesem User oder er war nie online.',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Hat nie die Nintendo Switch Online App genutzt',

    friends_since: 'Freunde seit: {{date, datetime}}',
    presence_updated_at: 'Aktivität aktualisiert: {{date, datetime}}',
    presence_logout_at: 'Zuletzt online: {{date, datetime}}',

    presence_sharing: 'Dieser User kann deine Aktivität sehen.',
    presence_not_sharing: 'Dieser User kann deine Aktivität nicht sehen.',

    discord_presence: 'Aktivität auf Discord teilen',
    close: 'Schließen',

    presence_playing: 'Spielt {{game}}',
    presence_offline: 'Offline',
    presence_last_seen: 'Zuletzt gesehen: {{since_logout}}',

    game_played_for_h: 'Gespielt für $t(hours, {"count": {{hours}}})',
    game_played_for_hm: 'Gespielt für $t(hours, {"count": {{hours}}}), $t(minutes, {"count": {{minutes}}})',
    game_played_for_m: 'Gespielt für $t(minutes, {"count": {{minutes}}})',
    hours_one: '{{count}} Stunde',
    hours_other: '{{count}} Stunden',
    minutes_one: '{{count}} Minute',
    minutes_other: '{{count}} Minuten',

    game_first_played: 'Zuerst gespielt am {{date, datetime}}',
    game_first_played_now: 'Zuerst gespielt jetzt',
    game_title_id: 'Titel ID',
    game_shop: 'Nintendo eShop',
};

export const addfriend_window = {
    title: 'Freund hinzufügen',
    help: 'Gebe oder füge einen Freundescode oder eine Freundescode-URL ein, um eine Freundschaftsanfrage zu senden.',

    lookup_error: 'Fehler beim Aufrufen des Freundescodes aufgetreten: {{message}}',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Hat nie die Nintendo Switch Online App genutzt',

    send_added: 'Du bist nun mit diesem User befreundet.',
    send_sent: 'Freundschaftsanfrage gesendet. {{user}} kann deine Freundschaftsanfrage über die Nintendo Switch Konsole annehmen oder dir eine Freundschaftsanfrage über die Nintendo Switch Online App oder nxapi senden.',
    send_sending: 'Sende Freundschaftsanfrage...',
    send_error: 'Fehler beim Senden der Freundschaftsanfrage aufgetreten: {{message}}',

    already_friends: 'Du bist bereits mit diesem User befreundet',

    close: 'Schließen',
    send: 'Anfrage senden',
};

export const discordsetup_window = {
    title: 'Discord Rich Presence Setup',

    mode_heading: '1. Wähle den Modus aus',
    mode_coral_friend: 'Wähle einen User, der mit dir befreundet ist, aus.',
    mode_url: 'Gebe eine URL ein, die deine Aktivität zurückgibt.',
    mode_none: 'Deaktivieren',

    coral_user_heading: '2. Wähle den User aus',
    coral_user_help: 'Der User muss mit dir befreundet sein, um die Aktivität zu teilen.',
    coral_friend_heading: '3. Wähle einen Freund aus',
    coral_friend_help: 'Das ist der User, den du teilen möchtest.',

    url_heading: '2. Gebe eine Presence-URL ein',
    url_help: 'Der Link muss eine HTTPS-URL sein, die ein JSON-Objekt mit einem User, Freund oder Aktivitätsschlüssel zurückgibt. Diese Funktion ist für nxapi\'s znc API Proxy vorgesehen.',

    preferences_heading: 'Konfiguriere zusätzliche Optionen für die Discord Rich Presence',
    preferences: 'Einstellungen',

    cancel: 'Abbrechen',
    save: 'Speichern',
};

export const addaccountmanual_window = {
    title: 'Account hinzufügen',

    authorise_heading: '1. Logge dich in deinen Nintendo Account ein.',
    authorise_help: 'Wähle noch keinen Account aus.',
    authorise_open: 'Öffne die Nintendo Account Authorisierung',

    response_heading: '2. Gebe den Weiterleitungslink ein',
    response_help_1: 'Rechtsklick auf der "Externen Account verlinken" Seite, Rechtsklick auf "Diese Person auswählen" und den Link kopieren. Der Link sollte mit "{{url}}". beginnen',
    response_help_2: 'Wenn du einen Kinder-Account, welcher mit deinem Account verlinkt ist, hinzufügen möchtest, klicke auf \"Diese Person auswählen\". Wenn dann nur der Kinder-Account angezeigt wird, Rechtsklick auf \"Diese Person auswählen\" und den Link kopieren.',

    cancel: 'Abbrechen',
    save: 'Account hinzufügen',
};
