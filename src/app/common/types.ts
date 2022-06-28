import { DiscordPresencePlayTime } from '../../discord/util.js';

export enum WindowType {
    MAIN_WINDOW = 'App',
    FRIEND = 'Friend',
    DISCORD_PRESENCE = 'DiscordPresence',
}

interface WindowProps {
    [WindowType.MAIN_WINDOW]: import('../browser/main/index.js').AppProps;
    [WindowType.FRIEND]: import('../browser/friend/index.js').FriendProps;
    [WindowType.DISCORD_PRESENCE]: import('../browser/discord/index.js').DiscordSetupProps;
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
}

export type DiscordPresenceSource = DiscordPresenceSourceCoral | DiscordPresenceSourceUrl;
export interface DiscordPresenceSourceCoral {
    na_id: string;
    friend_nsa_id?: string;
}
export interface DiscordPresenceSourceUrl {
    url: string;
}
