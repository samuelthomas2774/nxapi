export enum WindowType {
    MAIN_WINDOW = 'App',
    FRIEND = 'Friend',
}

interface WindowProps {
    [WindowType.MAIN_WINDOW]: import('../browser/app.js').AppProps;
    [WindowType.FRIEND]: import('../browser/friend/index.js').FriendProps;
}

export interface WindowConfiguration<T extends WindowType = WindowType> {
    type: T;
    props: WindowProps[T];
}

export type DiscordPresenceSource = DiscordPresenceSourceZnc | DiscordPresenceSourceUrl;
export interface DiscordPresenceSourceZnc {
    na_id: string;
    friend_nsa_id?: string;
}
export interface DiscordPresenceSourceUrl {
    url: string;
}
