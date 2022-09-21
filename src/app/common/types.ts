import { DiscordPresencePlayTime } from '../../discord/types.js';

export enum WindowType {
    MAIN_WINDOW = 'App',
    FRIEND = 'Friend',
    DISCORD_PRESENCE = 'DiscordPresence',
    ADD_FRIEND = 'AddFriend',
    PREFERENCES = 'Preferences',
    ADD_ACCOUNT_MANUAL_PROMPT = 'AddAccountManualPrompt',
}

interface WindowProps {
    [WindowType.MAIN_WINDOW]: import('../browser/main/index.js').AppProps;
    [WindowType.FRIEND]: import('../browser/friend/index.js').FriendProps;
    [WindowType.DISCORD_PRESENCE]: import('../browser/discord/index.js').DiscordSetupProps;
    [WindowType.ADD_FRIEND]: import('../browser/add-friend/index.js').AddFriendProps;
    [WindowType.PREFERENCES]: import('../browser/preferences/index.js').PreferencesProps;
    [WindowType.ADD_ACCOUNT_MANUAL_PROMPT]: import('../browser/add-account-manual/index.js').AddAccountManualPromptProps;
}

export interface WindowConfiguration<T extends WindowType = WindowType> {
    type: T;
    props: WindowProps[T];
}

export interface DiscordPresenceConfiguration {
    source: DiscordPresenceSource;
    /** Discord user ID */
    user?: string;
    /** Friend code in the format "0000-0000-0000" */
    friend_code?: string;
    show_console_online?: boolean;
    show_active_event?: boolean;
    show_play_time?: DiscordPresencePlayTime;
    monitors?: DiscordPresenceExternalMonitorsConfiguration;
}

export type DiscordPresenceSource = DiscordPresenceSourceCoral | DiscordPresenceSourceUrl;
export interface DiscordPresenceSourceCoral {
    na_id: string;
    friend_nsa_id?: string;
}
export interface DiscordPresenceSourceUrl {
    url: string;
}

export interface DiscordPresenceExternalMonitorsConfiguration {
    enable_splatnet3_monitoring?: boolean;
}
