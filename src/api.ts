import fetch from 'node-fetch';
import { v4 as uuidgen } from 'uuid';
import { stringify as buildQueryString } from 'querystring';
import createDebug from 'debug';

const debug = createDebug('api');

export default class ZncApi {
    constructor(
        private token: string
    ) {}

    protected async fetch<T = unknown>(url: string, method = 'GET', body?: string, headers?: object) {
        const response = await fetch('https://api-lp1.znc.srv.nintendo.net' + url, {
            method: method,
            body: body,
            headers: Object.assign({
                'X-Platform': 'Android',
                'X-ProductVersion': '2.0.0',
                'Authorization': 'Bearer ' + this.token,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': 'com.nintendo.znca/2.0.0(Android/8.0.0)',
            }, headers),
        });

        const data = await response.json() as ZncResponse<T>;

        if ('errorMessage' in data) {
            const error = new Error('[znc] ' + data.errorMessage);
            // @ts-expect-error
            error.response = response;
            // @ts-expect-error
            error.data = data;
            throw error;
        }
        if (data.status !== 0) {
            const error = new Error('[znc] Unknown error');
            // @ts-expect-error
            error.response = response;
            // @ts-expect-error
            error.data = data;
            throw error;
        }

        return data;
    }

    async getAnnouncements() {
        return this.fetch<Announcement[]>('/v1/Announcement/List', 'POST', '{"parameter":{}}');
    }

    async getFriendList() {
        return this.fetch<Friends>('/v3/Friend/List', 'POST', '{"parameter":{}}');
    }

    async getWebServices() {
        const uuid = uuidgen();

        return this.fetch<WebService[]>('/v1/Game/ListWebServices', 'POST', JSON.stringify({
            requestId: uuid,
        }));
    }

    async getActiveEvent() {
        return this.fetch<ActiveEvent>('/v1/Event/GetActiveEvent', 'POST', '{"parameter":{}}');
    }

    async getCurrentUser() {
        return this.fetch<CurrentUser>('/v3/User/ShowSelf', 'POST', '{"parameter":{}}');
    }

    async getWebServiceToken(id: string, nintendoAccountToken: string) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        const flapg = await ZncApi.flapg(nintendoAccountToken, timestamp, uuid, 'app');

        const req = {
            id,
            registrationToken: flapg.p1,
            f: flapg.f,
            requestId: flapg.p3,
            timestamp: flapg.p2,
        };

        return this.fetch<WebServiceToken>('/v2/Game/GetWebServiceToken', 'POST', JSON.stringify({
            parameter: req,
        }));
    }

    static async createWithSessionToken(token: string) {
        const data = await this.loginWithSessionToken(token);

        return {
            nso: new this(data.credential.accessToken),
            data,
        };
    }

    async renewToken(token: string) {
        const data = await ZncApi.loginWithSessionToken(token);

        this.token = data.credential.accessToken;

        return data;
    }

    static async loginWithSessionToken(token: string) {
        const uuid = uuidgen();
        const timestamp = '' + Math.floor(Date.now() / 1000);

        //
        // Nintendo Account token
        //

        debug('[na] Getting Nintendo Account token');

        const nintendoAccountTokenResponse = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/token', {
            method: 'POST',
            body: JSON.stringify({
                client_id: '71b963c1b7b6d119',
                session_token: token,
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 8.0.0)',
            },
        });

        const nintendoAccountToken = await nintendoAccountTokenResponse.json() as
            NintendoAccountToken | NintendoAccountError;

        if ('errorCode' in nintendoAccountToken) {
            const error = new Error('[na] ' + nintendoAccountToken.detail);
            // @ts-expect-error
            error.response = nintendoAccountTokenResponse;
            // @ts-expect-error
            error.data = nintendoAccountToken;
            throw error;
        }

        debug('[na] Got Nintendo Account token', nintendoAccountToken);

        //
        // Nintendo Account user data
        //

        debug('[na] Getting Nintendo Account user info');

        const userResponse = await fetch('https://api.accounts.nintendo.com/2.0.0/users/me', {
            headers: {
                'Accept-Language': 'en-GB',
                'User-Agent': 'NASDKAPI; Android',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + nintendoAccountToken.access_token!,
            },
        });

        const user = await userResponse.json() as NintendoAccountUser | NintendoAccountError;

        if ('errorCode' in user) {
            const error = new Error('[na] ' + user.detail);
            // @ts-expect-error
            error.response = userResponse;
            // @ts-expect-error
            error.data = user;
            throw error;
        }

        debug('[na] Got Nintendo Account user info', user);

        //
        // Nintendo Switch Online app token
        //

        const flapg = await this.flapg(nintendoAccountToken.id_token, timestamp, uuid, 'nso');

        debug('[znc] Getting Nintendo Switch Online app token');

        const response = await fetch('https://api-lp1.znc.srv.nintendo.net/v3/Account/Login', {
            method: 'POST',
            body: JSON.stringify({
                parameter: {
                    naIdToken: flapg.p1,
                    naBirthday: user.birthday,
                    naCountry: user.country,
                    language: user.language,
                    timestamp: flapg.p2,
                    requestId: flapg.p3,
                    f: flapg.f,
                },
            }),
            headers: {
                'X-Platform': 'Android',
                'X-ProductVersion': '2.0.0',
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': 'com.nintendo.znca/2.0.0(Android/8.0.0)',
            },
        });

        const data = await response.json() as ZncResponse<AccountLogin>;

        debug('[znc] Got Nintendo Switch Online app token', data);

        if ('errorMessage' in data) {
            const error = new Error('[znc] ' + data.errorMessage);
            // @ts-expect-error
            error.response = response;
            // @ts-expect-error
            error.data = data;
            throw error;
        }
        if (data.status !== 0) {
            const error = new Error('[znc] Unknown error');
            // @ts-expect-error
            error.response = response;
            // @ts-expect-error
            error.data = data;
            throw error;
        }

        return {
            uuid,
            timestamp,
            nintendoAccountToken,
            user,
            flapg,
            credential: data.result.webApiServerCredential,
        };
    }

    static async getLoginHash(token: string, timestamp: string | number) {
        debug('[s2s] Getting login hash');

        const response = await fetch('https://elifessler.com/s2s/api/gen2', {
            method: 'POST',
            body: buildQueryString({
                naIdToken: token,
                timestamp: '' + timestamp,
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'discord-switch-presence/1.0.0',
            },
        });

        const data = await response.json() as LoginHashApiResponse | LoginHashApiError;

        if ('error' in data) {
            const error = new Error('[s2s] ' + data.error);
            // @ts-expect-error
            error.response = response;
            // @ts-expect-error
            error.data = data;
            throw error;
        }

        debug('[s2s] Got login hash "%s"', data.hash, data);

        return data.hash;
    }

    static async flapg(token: string, timestamp: string | number, guid: string, iid: 'nso' | 'app') {
        const hash = await this.getLoginHash(token, timestamp);

        debug('[flapg] Getting f parameter', {
            token, timestamp, guid, iid,
        });

        const response = await fetch('https://flapg.com/ika2/api/login?public', {
            headers: {
                'x-token': token,
                'x-time': '' + timestamp,
                'x-guid': guid,
                'x-hash': hash,
                'x-ver': '3',
                'x-iid': iid,
            },
        });

        const data = await response.json() as FlapgApiResponse;

        debug('[flapg] Got f parameter "%s"', data.result.f);

        return data.result;
    }
}

interface LoginHashApiResponse {
    hash: string;
}
interface LoginHashApiError {
    error: string;
}

export interface FlapgApiResponse {
    result: {
        f: string;
        p1: string;
        p2: string;
        p3: string;
    };
}

export interface NintendoAccountToken {
    scope: ['openid', 'user', 'user.birthday', 'user.mii', 'user.screenName'];
    token_type: 'Bearer';
    id_token: string;
    access_token?: string;
    expires_in: 900;
}

export interface NintendoAccountUser {
    emailOptedIn: boolean;
    language: string;
    country: string;
    timezone: {
        name: string;
        id: string;
        utcOffsetSeconds: number;
        utcOffset: string;
    };
    region: null;
    nickname: string;
    clientFriendsOptedIn: boolean;
    mii: {
        favoriteColor: string;
        id: string;
        updatedAt: number;
        coreData: {
            '4': string;
        }
        clientId: '1cfe3a55ed8924d9';
        imageUriTemplate: string;
        storeData: {
            '3': string;
        };
        imageOrigin: string;
        etag: string;
        type: 'profile';
    };
    isChild: boolean;
    eachEmailOptedIn: {
        survey: {
            updatedAt: number;
            optedIn: boolean;
        };
        deals: {
            updatedAt: number;
            optedIn: boolean;
        };
    };
    updatedAt: number;
    candidateMiis: unknown[];
    id: string;
    createdAt: number;
    emailVerified: boolean;
    analyticsPermissions: {
        internalAnalysis: {
            updatedAt: number;
            permitted: boolean;
        };
        targetMarketing: {
            updatedAt: number;
            permitted: boolean;
        };
    };
    emailOptedInUpdatedAt: number;
    birthday: string;
    screenName: string;
    gender: string;
    analyticsOptedInUpdatedAt: number;
    analyticsOptedIn: boolean;
    clientFriendsOptedInUpdatedAt: number;
}

interface NintendoAccountError {
    errorCode: string;
    detail: string;
    instance: string;
    title: string;
    status: number;
    type: string;
}

interface ZncSuccessResponse<T = unknown> {
    status: 0;
    result: T;
    correlationId: string;
}

interface ZncErrorResponse {
    status: number;
    errorMessage: string;
    correlationId: string;
}

type ZncResponse<T = unknown> = ZncSuccessResponse<T> | ZncErrorResponse;

export interface AccountLogin {
    user: {
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
            presence: string;
        };
        presence: Presence;
    };
    webApiServerCredential: {
        accessToken: string;
        expiresIn: number;
    };
    firebaseCredential: {
        accessToken: string;
        expiresIn: number;
    };
}

interface Announcement {
    announcementId: number;
    priority: number;
    forceDisplayEndDate: number;
    distributionDate: number;
    title: string;
    description: string;
}

interface Friends {
    friends: Friend[];
}

interface Friend {
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
    OFFLINE = 'OFFLINE',
    INACTIVE = 'INACTIVE',
    ONLINE = 'ONLINE',
}

export interface Game {
    name: string;
    imageUri: string;
    shopUri: string;
    totalPlayTime: number;
    firstPlayedAt: number;
    sysDescription: string;
}

interface WebService {
    id: number;
    uri: string;
    customAttributes: WebServiceAttribute[];
    whiteList: string[];
    name: string;
    imageUri: string;
}

interface WebServiceAttribute {
    attrValue: string;
    attrKey: string;
}

interface ActiveEvent {
    // ??
}

interface CurrentUser {
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
                };
            };
        };
        friendCode: {
            regenerable: boolean;
            regenerableAt: number;
            id: string;
        };
    };
    permissions: {
        presence: string;
    };
    presence: Presence;
}

interface WebServiceToken {
    accessToken: string;
    expiresIn: number;
}
