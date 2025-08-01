import { CREDITS_NOTICE, LICENCE_NOTICE, ZNCA_API_USE_TEXT } from '../../../common/constants.js';

export const app = {
    default_title: 'Nintendo Switch Online',

    licence: LICENCE_NOTICE,
    credits: CREDITS_NOTICE,
    translation_credits: '{{language}} translation by {{authors, list}}.',
};

export const app_menu = {
    preferences: 'Preferences',
    view: 'View',
    learn_more: 'Learn More',
    learn_more_github: 'Learn More (GitHub)',
    search_issues: 'Search Issues',
    export_logs: 'Export Logs',

    refresh: 'Refresh',
};

export const menu_app = {
    coral_heading: 'Nintendo Switch Online',
    na_id: 'Nintendo Account ID: {{id}}',
    coral_id: 'Coral ID: {{id}}',
    nsa_id: 'NSA ID: {{id}}',
    discord_presence_enable: 'Enable Discord Presence',
    user_notifications_enable: 'Enable notifications for this user\'s presence',
    friend_notifications_enable: 'Enable notifications for friends of this user\'s presence',
    refresh: 'Update now',
    add_friend: 'Add friend',
    web_services: 'Web services',

    moon_heading: 'Nintendo Switch Parental Controls',

    add_account: 'Add account',

    show_main_window: 'Show main window',
    preferences: 'Preferences',
    quit: 'Quit',
};

export const menus = {
    add_account: {
        add_account_coral: 'Add Nintendo Switch Online account',
        add_account_moon: 'Add Nintendo Switch Parental Controls account',
    },

    friend_code: {
        share: 'Share',
        copy: 'Copy',
        friend_code_regenerable: 'Regenerate using a Nintendo Switch console',
        friend_code_regenerable_at: 'Can be regenerated at {{date, datetime}}',
    },

    user: {
        na_id: 'Nintendo Account ID: {{id}}',
        coral_id: 'Coral ID: {{id}}',
        nsa_id: 'NSA ID: {{id}}',
        discord_disable: 'Disable Discord presence',
        discord_enabled_for: 'Discord presence enabled for {{name}}',
        discord_enabled_via: 'Discord presence enabled using {{name}}',
        discord_enable: 'Enable Discord presence for this user...',
        friend_notifications_enable: 'Enable friend notifications',
        refresh: 'Update now',
        add_friend: 'Add friend',
        remove_help: 'Use the nxapi command to remove this user',
    },

    friend: {
        presence_online: 'Online',
        presence_online_nx: 'Online (Nintendo Switch)',
        presence_online_ounce: 'Online (Nintendo Switch 2)',
        game_first_played: 'First played: {{date, datetime}}',

        game_play_time_h: 'Play time: $t(friend.hours, {"count": {{hours}}})',
        game_play_time_hm: 'Play time: $t(friend.hours, {"count": {{hours}}}), $t(friend.minutes, {"count": {{minutes}}})',
        game_play_time_m: 'Play time: $t(friend.minutes, {"count": {{minutes}}})',
        hours_one: '{{count}} hour',
        hours_other: '{{count}} hours',
        minutes_one: '{{count}} minute',
        minutes_other: '{{count}} minutes',

        presence_inactive: 'Offline (console online)',
        presence_offline: 'Offline',
        presence_updated: 'Updated: {{date, datetime}}',
        presence_logout_time: 'Logout time: {{date, datetime}}',
        discord_presence_enable: 'Enable Discord Presence',
    },
};

export const notifications = {
    playing: 'Playing {{name}}',
    offline: 'Offline',
};

export const handle_uri = {
    friend_code_select: 'Select a user to add friends',
    web_service_select: 'Select a user to open this web service',
    web_service_invalid_title: 'Invalid web service',
    web_service_invalid_detail: 'The URL did not reference an existing web service.',
    cancel: 'Cancel',
};

export const na_auth = {
    window: {
        title: 'Nintendo Account',
    },

    znca_api_use: {
        title: 'Third-party API usage',

        // This should be translated in other languages
        text: ZNCA_API_USE_TEXT,

        ok: 'OK',
        cancel: 'Cancel',
        more_information: 'More information',
    },

    notification_coral: {
        title: 'Nintendo Switch Online',
        body_existing: 'Already signed in as {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
        body_authenticated: 'Authenticated as {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
        body_reauthenticated: 'Reauthenticated to {{name}} (Nintendo Account {{na_name}} / {{na_username}})',
    },

    notification_moon: {
        title: 'Nintendo Switch Parental Controls',
        body_existing: 'Already signed in as {{na_name}} ({{na_username}})',
        body_authenticated: 'Authenticated as {{na_name}} ({{na_username}})',
        body_reauthenticated: 'Reauthenticated to {{na_name}} ({{na_username}})',
    },

    error: {
        title: 'Error adding account',
    },
};

export const time_since = {
    default: {
        now: 'just now',
        seconds_one: '{{count}} second ago',
        seconds_other: '{{count}} seconds ago',
        minutes_one: '{{count}} minute ago',
        minutes_other: '{{count}} minutes ago',
        hours_one: '{{count}} hour ago',
        hours_other: '{{count}} hours ago',
        days_one: '{{count}} day ago',
        days_other: '{{count}} days ago',
    },

    short: {
        now: 'Just now',
        seconds_one: '{{count}} sec',
        seconds_other: '{{count}} secs',
        minutes_one: '{{count}} min',
        minutes_other: '{{count}} mins',
        hours_one: '{{count}} hr',
        hours_other: '{{count}} hrs',
        days_one: '{{count}} day',
        days_other: '{{count}} days',
    },
};

export const main_window = {
    sidebar: {
        discord_active: 'Discord Rich Presence active',
        discord_active_friend: 'Discord Rich Presence active: <0></0>',
        discord_not_active: 'Discord Rich Presence not active',
        discord_playing: 'Playing',
        discord_not_connected: 'Not connected to Discord',

        add_user: 'Add user',
        discord_setup: 'Set up Discord Rich Presence',
    },

    update: {
        update_available: 'Update available: {{name}}',
        download: 'Download',
        error: 'Error checking for updates: {{message}}',
        retry: 'Try again',
    },

    main_section: {
        error: {
            title: 'Error loading data',
            message: 'An error occured while loading {{errors, list}} data.',
            message_friends: 'friends',
            message_webservices: 'game-specific services',
            message_event: 'voice chat',
            retry: 'Retry',
            view_details: 'View details',
        },

        moon_only_user: {
            title: 'Nintendo Switch Online',
            desc_1: 'This user is signed in to the Nintendo Switch Parental Controls app, but not the Nintendo Switch Online app.',
            desc_2: 'Login to the Nintendo Switch Online app to view details here, or use the nxapi command to access Parental Controls data.',
            login: 'Login',
        },

        section_error: 'Error updating data',
    },

    discord_section: {
        title: 'Discord Rich Presence',

        setup_with_existing_user: 'Use one of these accounts to set up Discord Rich Presence for this user: <0></0>.',
        add_user: 'Add a Nintendo Switch Online account with this user as a friend to set up Discord Rich Presence.',
        active_self: 'This user\'s presence is being shared to Discord.',
        active_friend: '<0></0>\'s presence is being shared to Discord using this account.',
        active_unknown: 'An unknown user\'s presence is being shared to Discord using this account.',
        active_via: 'This user\'s presence is being shared to Discord using <0></0>.',

        setup: 'Setup',
        disable: 'Disable',
    },

    friends_section: {
        title: 'Friends',
        add: 'Add',

        no_friends: 'Add friends using a Nintendo Switch console.',
        friend_code: 'Your friend code: <0></0>',

        presence_playing: 'Playing',
        presence_offline: 'Offline',
    },

    webservices_section: {
        title: 'Game-specific services',
    },

    event_section: {
        title: 'Voice chat',

        members: '{{event}} in game, {{voip}} in voice chat',
        members_with_total: '{{event}} in game, {{voip}} in voice chat of {{total}} members',

        app_start: 'Use the Nintendo Switch Online app on iOS or Android to start voice chat.',
        app_join: 'Use the Nintendo Switch Online app on iOS or Android to join voice chat.',

        share: 'Share',
    },
};

export const preferences_window = {
    title: 'Preferences',

    startup: {
        heading: 'Startup',
        login: 'Open at login',
        background: 'Open in background',
    },

    sleep: {
        heading: 'Sleep',
    },

    discord: {
        heading: 'Discord Rich Presence',
        enabled: 'Discord Rich Presence is enabled.',
        disabled: 'Discord Rich Presence is disabled.',
        setup: 'Discord Rich Presence setup',

        user: 'Discord user',
        user_any: 'First discovered',

        friend_code: 'Friend code',
        friend_code_help: 'Adding your friend code will also show your Nintendo Switch user icon in Discord.',
        friend_code_self: 'Share my friend code',
        friend_code_custom: 'Set custom friend code',

        inactive_presence: 'Show inactive presence',
        inactive_presence_help: 'Shows "Not playing" when a console linked to your account is online, but you are not selected in a game.',

        play_time: 'Play time',
        play_time_hidden: 'Never show play time',
        play_time_nintendo: 'Show play time as it appears on a Nintendo Switch console',
        play_time_approximate_play_time: 'Show approximate play time (nearest 5 hours)',
        play_time_approximate_play_time_since: 'Show approximate play time (nearest 5 hours) with first played date',
        play_time_hour_play_time: 'Show approximate play time (nearest hour)',
        play_time_hour_play_time_since: 'Show approximate play time (nearest hour) with first played date',
        play_time_detailed_play_time: 'Show exact play time',
        play_time_detailed_play_time_since: 'Show exact play time with first played date',
    },

    splatnet3: {
        heading: 'SplatNet 3',
        discord: 'Enable enhanced Discord Rich Presence for Splatoon 3',
        discord_help_1: 'Uses SplatNet 3 to retrieve additional presence information while playing Splatoon 3. You must be using a secondary Nintendo Account that is friends with your main account to fetch your presence, and the secondary account must be able to access SplatNet 3.',
        discord_help_2: 'When using a presence URL that returns Splatoon 3 data additional presence information will be shown regardless of this setting.',
    },
};

export const friend_window = {
    no_presence: 'You don\'t have access to this user\'s presence, or they have never been online.',

    nsa_id: 'NSA ID',
    coral_id: 'Coral user ID',
    no_coral_user: 'Never used the Nintendo Switch Online app',

    friends_since: 'Friends since {{date, datetime}}',
    presence_updated_at: 'Presence updated at {{date, datetime}}',
    presence_logout_at: 'Last online at {{date, datetime}}',

    presence_sharing: 'This user can see your presence.',
    presence_not_sharing: 'This user can not see your presence.',

    discord_presence: 'Share presence to Discord',
    close: 'Close',

    presence_playing: 'Playing {{game}}',
    presence_playing_nx: 'Playing {{game}} (Nintendo Switch)',
    presence_playing_ounce: 'Playing {{game}} (Nintendo Switch 2)',
    presence_offline: 'Offline',
    presence_last_seen: 'Last seen {{since_logout}}',

    game_played_for_h: 'Played for $t(hours, {"count": {{hours}}})',
    game_played_for_hm: 'Played for $t(hours, {"count": {{hours}}}), $t(minutes, {"count": {{minutes}}})',
    game_played_for_m: 'Played for $t(minutes, {"count": {{minutes}}})',
    hours_one: '{{count}} hour',
    hours_other: '{{count}} hours',
    minutes_one: '{{count}} minute',
    minutes_other: '{{count}} minutes',

    game_first_played: 'First played {{date, datetime}}',
    game_first_played_now: 'First played now',
    game_title_id: 'Title ID',
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
