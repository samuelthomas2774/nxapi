
export interface ZncSuccessResponse<T = unknown> {
    status: 0;
    result: T;
    correlationId: string;
}

export interface ZncErrorResponse {
    status: number;
    errorMessage: string;
    correlationId: string;
}

export type ZncResponse<T = unknown> = ZncSuccessResponse<T> | ZncErrorResponse;

export interface AccountLogin {
    user: CurrentUser;
    webApiServerCredential: {
        accessToken: string;
        expiresIn: number;
    };
    firebaseCredential: {
        accessToken: string;
        expiresIn: number;
    };
}

export interface Announcement {
    announcementId: number;
    priority: number;
    forceDisplayEndDate: number;
    distributionDate: number;
    title: string;
    description: string;
}

export interface Friends {
    friends: Friend[];
}

export interface Friend {
    id: number;
    nsaId: string;
    imageUri: string;
    name: string;
    isFriend: boolean;
    isFavoriteFriend: boolean;
    isServiceUser: boolean;
    friendCreatedAt: number;
    presence: Presence;
}

export interface Presence {
    state: PresenceState;
    updatedAt: number;
    logoutAt: number;
    game: Game | {};
}

export enum PresenceState {
    /** Offline */
    OFFLINE = 'OFFLINE',
    /** A console linked to this account is online, but the user isn't selected in an application */
    INACTIVE = 'INACTIVE',
    /** The user is selected in an application */
    ONLINE = 'ONLINE',
    /** The user is selected in an application (and I assume playing online?) */
    PLAYING = 'PLAYING',
}

export interface Game {
    name: string;
    imageUri: string;
    shopUri: string;
    totalPlayTime: number;
    firstPlayedAt: number;
    sysDescription: string;
}

export interface WebService {
    id: number;
    uri: string;
    customAttributes: WebServiceAttribute[];
    whiteList: string[];
    name: string;
    imageUri: string;
}

export interface WebServiceAttribute {
    attrValue: string;
    attrKey: string;
}

export interface ActiveEvent {
    // ??
}

export interface CurrentUser {
    id: number;
    nsaId: string;
    imageUri: string;
    name: string;
    supportId: string;
    isChildRestricted: boolean;
    etag: string;
    links: {
        nintendoAccount: {
            membership: {
                active: {
                    active: boolean;
                } | boolean;
            };
        };
        friendCode: {
            regenerable: boolean;
            regenerableAt: number;
            id: string;
        };
    };
    permissions: {
        presence: PresencePermissions;
    };
    presence: Presence;
}
export enum PresencePermissions {
    FRIENDS = 'FRIENDS',
    FAVORITE_FRIENDS = 'FAVORITE_FRIENDS',
    SELF = 'SELF',
}

export interface WebServiceToken {
    accessToken: string;
    expiresIn: number;
}
