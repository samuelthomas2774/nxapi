import * as yargs from 'yargs';
import type * as yargstypes from '../node_modules/@types/yargs/index.js';
import createDebug from 'debug';
import DiscordRPC from 'discord-rpc';
import persist from 'node-persist';
import getPaths from 'env-paths';
import { FlapgApiResponse } from './api/f.js';
import { NintendoAccountToken, NintendoAccountUser } from './api/na.js';
import { AccountLogin, CurrentUser, Game } from './api/znc-types.js';
import ZncApi from './api/znc.js';
import titles, { defaultTitle } from './titles.js';
import ZncProxyApi from './api/znc-proxy.js';

const debug = createDebug('cli');

export const paths = getPaths('nintendo-znc');

export type YargsArguments<T extends yargs.Argv> = T extends yargs.Argv<infer R> ? R : any;
export type Argv<T = {}> = yargs.Argv<T>;
export type ArgumentsCamelCase<T = {}> = yargstypes.ArgumentsCamelCase<T>;

export interface SavedToken {
    uuid: string;
    timestamp: string;
    nintendoAccountToken: NintendoAccountToken;
    user: NintendoAccountUser;
    flapg: FlapgApiResponse['result'];
    nsoAccount: AccountLogin;
    credential: AccountLogin['webApiServerCredential'];

    expires_at: number;
    proxy_url?: string;
}

export async function initStorage(dir: string) {
    const storage = persist.create({
        dir,
        stringify: data => JSON.stringify(data, null, 4) + '\n',
    });
    await storage.init();
    return storage;
}

export async function getToken(storage: persist.LocalStorage, token: string, proxy_url?: string) {
    if (!token) {
        console.error('No token set. Set a Nintendo Account session token using the `--token` option or by running `nintendo-znc token`.');
        throw new Error('Invalid token');
    }

    const existingToken: SavedToken | undefined = await storage.getItem('NsoToken.' + token);

    if (!existingToken || existingToken.expires_at <= Date.now()) {
        console.log('Authenticating to Nintendo Switch Online app');
        debug('Authenticating to znc with session token');

        const {nso, data} = proxy_url ?
            await ZncProxyApi.createWithSessionToken(proxy_url, token) :
            await ZncApi.createWithSessionToken(token);

        const existingToken: SavedToken = {
            ...data,
            expires_at: Date.now() + (data.credential.expiresIn * 1000),
        };

        await storage.setItem('NsoToken.' + token, existingToken);
        await storage.setItem('NintendoAccountToken.' + data.user.id, token);

        return {nso, data: existingToken};
    }

    debug('Using existing token');
    await storage.setItem('NintendoAccountToken.' + existingToken.user.id, token);

    return {
        nso: proxy_url ?
            new ZncProxyApi(proxy_url, token) :
            new ZncApi(existingToken.credential.accessToken),
        data: existingToken,
    };
}

export function getTitleIdFromEcUrl(url: string) {
    const match = url.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);
    return match?.[1] ?? null;
}

export function getDiscordPresence(game: Game, friendcode?: CurrentUser['links']['friendCode']): {
    id: string;
    title: string | null;
    presence: DiscordRPC.Presence;
    showTimestamp?: boolean;
} {
    const titleid = getTitleIdFromEcUrl(game.shopUri);
    const title = titles.find(t => t.id === titleid) || defaultTitle;

    const hours = Math.floor(game.totalPlayTime / 60);
    const minutes = game.totalPlayTime - (hours * 60);

    const text = [];

    if (title.titleName === true) text.push(game.name);
    else if (title.titleName) text.push(title.titleName);

    if (game.sysDescription) text.push(game.sysDescription);

    if (hours >= 1) text.push('Played for ' + hours + ' hour' + (hours === 1 ? '' : 's') +
        (minutes ? ', ' + minutes + ' minute' + (minutes === 1 ? '' : 's'): '') +
        ' since ' + new Date(game.firstPlayedAt * 1000).toLocaleDateString('en-GB'));

    if (friendcode && !title.largeImageKey) text.push('SW-' + friendcode.id);

    return {
        id: title.client || defaultTitle.client,
        title: titleid,
        presence: {
            details: text[0],
            state: text[1],
            largeImageKey: title.largeImageKey,
            largeImageText: friendcode && title.largeImageKey ? 'SW-' + friendcode.id : undefined,
            smallImageKey: title.smallImageKey,
        },
        showTimestamp: title.showTimestamp,
    };
}

export interface Title {
    /** Lowercase hexadecimal title ID */
    id: string;
    /** Discord client ID */
    client: string;

    titleName?: string | true;
    largeImageKey?: string;
    smallImageKey?: string;
    showTimestamp?: boolean;
}
