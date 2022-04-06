
export interface ZncSuccessResponse<T = unknown> {
    status: ZncStatus.OK;
    result: T;
    correlationId: string;
}

export interface ZncErrorResponse {
    status: ZncStatus | number;
    errorMessage: string;
    correlationId: string;
}
export enum ZncStatus {
    OK = 0,

    BAD_REQUEST = 9400,
    INVALID_TOKEN = 9403,
    TOKEN_EXPIRED = 9404,
    UPGRADE_REQUIRED = 9427,
}

export type ZncResponse<T = unknown> = ZncSuccessResponse<T> | ZncErrorResponse;

/** /v3/Account/Login */
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

/** /v1/Announcement/List */
export type Announcements = Announcement[];

export interface Announcement {
    announcementId: number;
    priority: number;
    forceDisplayEndDate: number;
    distributionDate: number;
    title: string;
    description: string;
}

/** /v3/Friend/List */
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
    /**
     * The user is selected in an application and playing online.
     * (Is this set by Nintendo's servers if the user is in a session on Nintendo's servers, or by the application
     * running on the console?)
     */
    PLAYING = 'PLAYING',
}

export interface Game {
    name: string;
    imageUri: string;
    shopUri: string;
    totalPlayTime: number;
    /** 0 if never played before */
    firstPlayedAt: number;
    sysDescription: string;
}

/** /v1/Game/ListWebServices */
export type WebServices = WebService[];

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

/** /v1/Event/GetActiveEvent */
export type ActiveEvent = _ActiveEvent | {};

export interface _ActiveEvent extends Event {
    activateId: string;
}

/** /v1/Event/Show */
export interface Event {
    id: number;
    name: string;
    description: string;
    shareUri: string;
    ownerUserId: number;
    members: EventMember[];
    passCode: string;
    eventType: 3; // ??
    allowJoinGameWithoutCoral: boolean;
    game: {
        id: number;
    };
    imageUri: string;
}

export interface EventMember {
    id: number;
    name: string;
    imageUri: string;
    isPlaying: boolean;
    isInvited: boolean;
    isJoinedVoip: boolean;
}

/** /v3/User/Show */
export interface User {
    id: number;
    nsaId: string;
    imageUri: string;
    name: string;
}

/** /v3/User/ShowSelf */
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

/** /v3/User/Permissions/ShowSelf */
export interface CurrentUserPermissions {
    etag: string;
    permissions: {
        presence: PresencePermissions;
    };
}

/** /v2/Game/GetWebServiceToken */
export interface WebServiceToken {
    accessToken: string;
    expiresIn: number;
}
