
export interface CoralSuccessResponse<T = unknown> {
    status: CoralStatus.OK;
    result: T;
    correlationId: string;
}

export interface CoralError {
    status: CoralStatus | number;
    errorMessage: string;
    correlationId: string;
}
export enum CoralStatus {
    OK = 0,

    BAD_REQUEST = 9400,
    METHOD_NOT_ALLOWED = 9401,
    RESOURCE_NOT_FOUND = 9402,
    INVALID_TOKEN = 9403,
    TOKEN_EXPIRED = 9404,
    FORBIDDEN = 9405,
    UNAUTHORISED = 9406,
    NSA_NOT_LINKED = 9407,
    USER_NOT_FOUND = 9408,
    APPLICATION_ID_NOT_SUPPORTED = 9409,
    EVENT_NOT_FOUND = 9411,
    EVENT_NOT_ACTIVATED = 9412,
    NOT_JOINED_VOICE_CHAT = 9416,
    DUPLICATE_APPLICATION_ID = 9417,
    OPERATION_NOT_ALLOWED = 9422,
    RATING_AGE = 9423,
    USER_NOT_ACTIVATED = 9424,
    INVITATION_LIMIT_EXCEEDED = 9425,
    MULTIPLE_LOGIN = 9426,
    UPGRADE_REQUIRED = 9427,
    ACCOUNT_DISABLED = 9428,
    RATE_LIMIT_EXCEEDED = 9437,
    MEMBERSHIP_REQUIRED = 9450,
    INVALID_FRIEND_REQUEST = 9460,
    SENDER_FRIEND_LIMIT_EXCEEDED = 9461,
    RECEIVER_FRIEND_LIMIT_EXCEEDED = 9462,
    FRIEND_REQUEST_NOT_ACCEPTED = 9463,
    DUPLICATE_FRIEND_REQUEST = 9464,
    PRECONDITION_FAILED = 9465,
    RESOURCE_LIMIT_EXCEEDED = 9466,
    ALREADY_FRIEND = 9467,
    SENDER_BLOCKS_RECEIVER_FRIEND_REQUEST = 9468,
    SERVICE_CLOSED = 9499,
    INTERNAL_SERVER_ERROR = 9500,
    SERVICE_UNAVAILABLE = 9501,
    MAINTENANCE = 9511,
    UNEXPECTED = 9599,
    // UNKNOWN = -1,
}

export type CoralResponse<T = unknown> = CoralSuccessResponse<T> | CoralError;

export interface AccountLoginParameter {
    naIdToken: string;
    naBirthday: string;
    naCountry: string;
    language: string;
    timestamp: number;
    requestId: string;
    f: string;
}

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

/** /v3/Account/GetToken, /v3/Extension/Account/GetToken */
export type AccountToken = AccountLogin;

export interface AccountTokenParameter {
    naIdToken: string;
    naBirthday: string;
    timestamp: number;
    requestId: string;
    f: string;
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
    link?: string;
    linkText?: string;
}

/** /v3/Friend/List */
export interface Friends {
    friends: Friend[];
}

/** /v4/Friend/List */
export interface Friends_4 {
    friends: Friend_4[];
    extractFriendsIds: string[];
}

export interface Friend {
    id: number;
    nsaId: string;
    imageUri: string;
    image2Uri: string;
    name: string;
    isFriend: boolean;
    isFavoriteFriend: boolean;
    isServiceUser: boolean;
    isNew: boolean;
    friendCreatedAt: number;
    route: FriendRoute;
    presence: Presence | PresenceOnline | PresenceOffline;
}

/** /v4/Friend/Show */
export interface Friend_4 extends Friend {
    isOnlineNotificationEnabled: boolean;
    presence: PresenceOnline_4 | PresenceOffline;
}

export interface FriendRoute {
    appName: string;
    /** In-game player name */
    userName: string;
    shopUri: string;
    imageUri: string;
    // if not IN_APP all other properties are empty strings
    channel: FriendRouteChannel;
}

export enum FriendRouteChannel {
    /** Added from friend code lookup on a Switch console or using coral */
    FRIEND_CODE = 'FRIEND_CODE',
    /** Added from users you've played with */
    IN_APP = 'IN_APP',
    /** Added from search for local users */
    NX_FACED = 'NX_FACED',
    '3DS' = '3DS',

    // Wii U, Facebook, Twitter suggestions?
}

export interface Presence {
    state: PresenceState;
    /**
     * Timestamp (in seconds) the user's presence was last updated.
     * This seems to change every hour if a linked console is online, even if the user's presence doesn't change.
     */
    updatedAt: number;
    logoutAt: number;
    game: PresenceGame | {};
}

export interface PresenceOnline extends Presence {
    state: PresenceState.ONLINE | PresenceState.PLAYING;
    game: PresenceGame;
}
export interface PresenceOnline_4 extends PresenceOnline {
    platform: PresencePlatform;
}
export interface PresenceOffline extends Presence {
    state: PresenceState.OFFLINE | PresenceState.INACTIVE;
    game: {};
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

export enum PresencePlatform {
    NINTENDO_SWITCH = 1,
}

export interface Game {
    name: string;
    imageUri: string;
    shopUri: string;
    totalPlayTime: number;
    /** 0 if never played before */
    firstPlayedAt: number;
}

export interface PresenceGame extends Game {
    sysDescription: string;
}

/** /v3/Friend/CreateFriendCodeUrl */
export interface FriendCodeUrl {
    url: string;
    friendCode: string;
}

/** /v3/Friend/GetUserByFriendCode, /v3/Friend/GetUserByFriendCodeHash */
export interface FriendCodeUser {
    id: number;
    nsaId: string;
    imageUri: string;
    image2Uri: string;
    name: string;
    isBlocking: boolean;
    extras: {};
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

export interface WebServiceTokenParameter {
    id: number;
    registrationToken: string;
    timestamp: number;
    requestId: string;
    f: string;
}

/** /v2/Game/GetWebServiceToken, /v2/Extension/Game/GetWebServiceToken */
export interface WebServiceToken {
    accessToken: string;
    expiresIn: number;
}

/** /v1/Event/GetActiveEvent */
export type GetActiveEventResult = ActiveEvent | {};

export interface ActiveEvent extends Event {
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
    image2Uri: string;
    name: string;
}

/** /v4/User/ShowSelf */
export interface CurrentUser {
    id: number;
    nsaId: string;
    imageUri: string;
    image2Uri: string;
    name: string;
    supportId: string;
    isChildRestricted: boolean;
    etag: string;
    links: {
        nintendoAccount: {
            membership: {
                active: boolean;
            };
        };
        friendCode: {
            regenerable: boolean;
            regenerableAt: number;
            id: string;
        };
    };
    permissions: {
        playLog: PlayLogPermissions;
        presence: PresencePermissions;
        friendRequestReception: boolean;
    };
    presence: PresenceOnline_4 | PresenceOffline;
}

export enum PlayLogPermissions {
    EVERYONE = 'EVERYONE',
    FRIENDS = 'FRIENDS',
    FAVORITE_FRIENDS = 'FAVORITE_FRIENDS',
    SELF = 'SELF',
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
        playLog: PlayLogPermissions;
        presence: PresencePermissions;
        friendRequestReception: boolean;
    };
}

export interface UpdateCurrentUserPermissionsParameter {
    permissions: {
        presence: {
            toValue: PresencePermissions;
            fromValue: PresencePermissions;
        };
    };
    etag: string;
}

/** /v4/User/PlayLog/Show */
export type UserPlayLog = Game[];

/** /v4/FriendRequest/Received/List */
export interface ReceivedFriendRequests {
    friendRequests: unknown[];
}

/** /v4/FriendRequest/Sent/List */
export interface SentFriendRequests {
    friendRequests: unknown[];
}

/** /v3/User/Block/List */
export interface BlockingUsers {
    blockingUsers: unknown[];
}
