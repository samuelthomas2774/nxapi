export interface MoonError {
    type: string; // "https://moon.nintendo.com/errors/v1/401/invalid_token"
    status: number; // 401
    errorCode: string; // "invalid_token"
    title: string; // "UnauthorizedException"
    detail: string; // ""
    instance: string;
}

/** GET /v1/users/{nintendoAccountId} */
export interface User {
    nintendoAccountId: string;
    nickname: string;
    country: string; // "GB"
    language: string; // "en-GB"
    miiUri: {
        extraLarge: string;
        large: string;
        medium: string;
        small: string;
        extraSmall: string;
    };
    analyticsOptedIn: boolean;
    acceptedNotification: {
        all: boolean;
    };
    notices: string[];
    createdAt: number;
    updatedAt: number;
}

/** GET /v1/users/{nintendoAccountId}/smart_devices */
export interface SmartDevices {
    count: number;
    items: SmartDevice[];
}

export interface SmartDevice {
    /** UUID v4, for iOS devices this is uppercase hex, for Android devices this is lowercase hex?? */
    id: string;
    nintendoAccountId: string;
    bundleId: string;
    os: SmartDeviceOS;
    osVersion: string;
    modelName: string;
    timeZone: string;
    appVersion: {
        displayedVersion: string; // "1.15.1", "1.16.0"
        internalVersion: number; // 305, 247
    };
    osLanguage: string;
    appLanguage: string;
    notificationToken: string | null;
    updateRequired: boolean;
    createdAt: number;
    updatedAt: number;
}
export enum SmartDeviceOS {
    IOS = 'IOS',
    ANDROID = 'ANDROID',
}

/** GET /v1/users/{nintendoAccountId}/devices */
export interface Devices {
    count: number;
    items: PairedDevice[];
}

export interface PairedDevice {
    deviceId: string;
    device: Device;
    nintendoAccountId: string;
    label: string;
    parentalControlSettingState: ParentalControlSettingState;
    hasNewMonthlySummary: boolean;
    hasFirstDailySummary: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface Device {
    id: string;
    notificationToken: string;
    timeZone: string;
    language: string;
    region: string; // "EUROPE"
    serialNumber: string;
    firmwareVersion: {
        displayedVersion: string; // "13.2.1"
        internalVersion: number; // 852481
    };
    links: {
        pairingCode: {
            code: string;
            createdAt: number;
            expiresAt: number;
        };
    };
    activated: boolean;
    synchronizedUnlockCode: string;
    synchronizedParentalControlSetting: {
        synchronizedEtag: string;
        synchronizedAt: number;
    };
    lastOnlineCheckedAt: number;
    alarmSetting: {
        visibility: AlarmStatus;
        invisibleUntil: number;
    };
    createdAt: number;
    updatedAt: number;
}

export enum AlarmStatus {
    VISIBLE = 'VISIBLE',
    INVISIBLE = 'INVISIBLE',
}

/** GET /v1/devices/{deviceId}/daily_summaries */
export interface DailySummaries {
    count: number;
    items: DailySummary[];
    updatedRecently: boolean;
}

export interface DailySummary {
    deviceId: string;
    date: string; // "2022-03-14"
    result: DailySummaryResult;
    playingTime: number;
    exceededTime: number | null;
    disabledTime: number;
    miscTime: number;
    importantInfos: ImportantInfo[];
    notices: Notice[];
    observations: Observation[];
    playedApps: PlayedTitle[];
    anonymousPlayer: AnonymousPlayer | null;
    devicePlayers: DevicePlayer[];
    timeZoneUtcOffsetSeconds: number;
    lastPlayedAt: number | null;
    createdAt: number;
    updatedAt: number;
}
export enum DailySummaryResult {
    CALCULATING = 'CALCULATING',
    ACHIEVED = 'ACHIEVED',
    UNACHIEVED = 'UNACHIEVED',
}
export enum ImportantInfo {
    DID_WRONG_UNLOCK_CODE = 'DID_WRONG_UNLOCK_CODE',
}
export enum Notice {
    DID_ALARM_MAKE_INVISIBLE = 'DID_ALARM_MAKE_INVISIBLE',
}

export interface Title {
    applicationId: string;
    title: string;
    imageUri: {
        extraSmall: string;
        small: string;
        medium: string;
        large: string;
        extraLarge: string;
    };
    hasUgc: boolean;
    shopUri: string;
    firstPlayDate: string | null;
}

export interface ObservationTitleDownloaded {
    type: 'DID_APP_DOWNLOAD_START';
    applications: ObservationTitleDownloadedTitle[];
}
export interface ObservationTitleDownloadedTitle extends Title {
    firstPlayDate: null;
}

export type Observation = ObservationTitleDownloaded;

export interface PlayedTitle extends Title {
    firstPlayDate: string;
}

export interface AnonymousPlayer {
    playingTime: number;
    playedApps: DevicePlayerTitle[];
}

export interface DevicePlayer extends AnonymousPlayer {
    playerId: string;
    nickname: string;
    imageUri: string;
}

export interface DevicePlayerTitle {
    applicationId: string;
    firstPlayDate: string;
    playingTime: number;
}

/** GET /v1/devices/{deviceId}/monthly_summaries */
export interface MonthlySummaries {
    count: number;
    indexes: string[]; // ["2022-02", ...]
    items: MonthlySummariesMonthlySummary[];
}
export interface MonthlySummariesMonthlySummary {
    deviceId: string;
    month: string; // "2022-02"
}

/** GET /v1/devices/{deviceId}/monthly_summaries/{month} */
export interface MonthlySummary {
    deviceId: string;
    month: string; // "2022-02"
    dailySummaries: Record<string, MonthlySummaryDailySummary>;
    playingDays: number;
    playedApps: MonthlySummaryPlayedTitle[];
    insights: MonthlySummaryInsights;
    devicePlayers: MonthlySummaryDevicePlayer[];
    includedMajorVersions: number[];
    createdAt: number;
    updatedAt: number;
}
export interface MonthlySummaryDevicePlayer {
    playerId: string;
    nickname: string;
    imageUri: string;
    dailySummaries: Record<string, MonthlySummaryDailySummary>;
    insights: MonthlySummaryInsights;
}
export interface MonthlySummaryDailySummary {
    date: string;
    result: 'ACHIEVED';
    playingTime: number;
}
export interface MonthlySummaryPlayedTitle extends PlayedTitle {
    playingDays: number;
    position: MonthlySummaryTitleRankingPosition;
}
export interface MonthlySummaryInsights {
    thisMonth: {
        averagePlayingTime: number;
        playingDays: number;
        playingTime: number;
    };
    previousMonth: {
        averagePlayingTime: number;
        playingDays: number;
        playingTime: number;
    } | null;
    rankings: {
        byDay: MonthlySummaryTitleRanking[];
        byTime: MonthlySummaryTitleRanking[];
    };
}
export interface MonthlySummaryTitleRanking {
    applicationId: string;
    units: number;
    position: MonthlySummaryTitleRankingPosition;
    ratio: number;
}
export enum MonthlySummaryTitleRankingPosition {
    UP = 'UP',
    STAY = 'STAY',
    DOWN = 'DOWN',
    NEW = 'NEW',
}

/** GET /v1/devices/{deviceId}/parental_control_setting_state */
export interface ParentalControlSettingState {
    deviceId: string;
    targetEtag: string;
    synchronizationStatus: SynchronizationStatus;
    createdAt: number;
    updatedAt: number;
}

export enum SynchronizationStatus {
    SYNCHRONIZED = 'SYNCHRONIZED',
    NOTIFIED = 'NOTIFIED',
    PENDING = 'PENDING',
    FAILED = 'FAILED',
}
