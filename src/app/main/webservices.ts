import * as path from 'node:path';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import createDebug from 'debug';
import { app, BrowserWindow, dialog, IpcMainInvokeEvent, Menu, MenuItem, nativeTheme, ShareMenu, shell, WebContents } from './electron.js';
import fetch from 'node-fetch';
import CoralApi from '../../api/coral.js';
import { dev } from '../../util/product.js';
import { WebService } from '../../api/coral-types.js';
import { Store } from './index.js';
import type { NativeShareRequest, NativeShareUrlRequest } from '../preload-webservice/znca-js-api.js';
import { SavedToken } from '../../common/auth/coral.js';
import { createWebServiceWindow } from './windows.js';
import { askUserForUri } from './util.js';

const debug = createDebug('app:main:webservices');

const windows = new Map<string, BrowserWindow>();
const windowapi = new WeakMap<WebContents, [Store, string, CoralApi, SavedToken, WebService]>();

export default async function openWebService(
    store: Store, token: string, nso: CoralApi, data: SavedToken,
    webservice: WebService, qs?: string
) {
    const windowid = data.nsoAccount.user.nsaId + ':' + webservice.id;

    if (windows.has(windowid)) {
        const window = windows.get(windowid)!;

        window.focus();

        return;
    }

    const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');

    if (verifymembership?.attrValue === 'true') {
        const membership = data.nsoAccount.user.links.nintendoAccount.membership;
        const active = typeof membership.active === 'object' ? membership.active.active : membership.active;
        if (!active) throw new Error('Nintendo Switch Online membership required');
    }

    const user_title_prefix = '[' + data.user.nickname +
        (data.nsoAccount.user.name !== data.user.nickname ? '/' + data.nsoAccount.user.name : '') + '] ';

    const window = createWebServiceWindow(data.nsoAccount.user.nsaId, webservice, user_title_prefix);

    windows.set(windowid, window);
    windowapi.set(window.webContents, [store, token, nso, data, webservice]);

    window.on('closed', () => {
        windows.delete(windowid);
        // windowapi.delete(window.webContents);
    });

    window.webContents.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';

    window.webContents.on('will-navigate', (event, url) => {
        debug('Web service will navigate', webservice.uri, webservice.whiteList, url);

        if (!isWebServiceUrlAllowed(webservice, url)) {
            debug('Web service attempted to navigate to a URL not allowed by it\'s `whiteList`', webservice, url);
            event.preventDefault();
        }
    });

    window.on('page-title-updated', (event, title, explicitSet) => {
        window.setTitle(user_title_prefix + (explicitSet ? title : webservice.name));
        event.preventDefault();
    });

    window.webContents.setWindowOpenHandler(details => {
        debug('open', details);
        shell.openExternal(details.url);
        return {action: 'deny'};
    });

    const webserviceToken = await nso.getWebServiceToken('' + webservice.id);

    const url = new URL(webservice.uri);
    url.search = new URLSearchParams({
        lang: data.user.language,
        na_country: data.user.country,
        na_lang: data.user.language,
    }).toString();

    const deepLinkingEnabled = webservice.customAttributes.find(a => a.attrKey === 'deepLinkingEnabled');

    if (deepLinkingEnabled?.attrValue === 'true' && qs) {
        url.search += '&' + qs;
    }

    debug('Loading web service', {
        url: url.toString(),
        webservice,
        webserviceToken,
        qs,
    });

    if (dev) window.webContents.openDevTools();

    window.loadURL(url.toString(), {
        extraHeaders: Object.entries({
            'x-appcolorscheme': nativeTheme.shouldUseDarkColors ? 'DARK' : 'LIGHT',
            'x-gamewebtoken': webserviceToken.accessToken,
            'dnt': '1',
            'X-Requested-With': 'com.nintendo.znca',
        }).map(([key, value]) => key + ': ' + value).join('\n'),
    });
}

function isWebServiceUrlAllowed(webservice: WebService, url: string | URL) {
    if (!webservice.whiteList) return true;

    if (typeof url === 'string') url = new URL(url);

    for (const host of webservice.whiteList) {
        if (host.startsWith('*.')) {
            return url.hostname === host.substr(2) ||
                url.hostname.endsWith(host.substr(1));
        }

        return url.hostname === host;
    }

    return false;
}

export async function handleOpenWebServiceUri(store: Store, uri: string) {
    const match = uri.match(/^com\.nintendo\.znca:\/\/(znca\/)game\/(\d+)\/?($|\?|\#)/i);
    if (!match) return;

    const webservice_id = parseInt(match[2]);

    const selected_user = await askUserForWebServiceUri(store, uri);
    if (!selected_user) return;

    const {nso, data, webservices} = await store.users.get(selected_user[0]);

    const webservice = webservices.result.find(w => w.id === webservice_id);
    if (!webservice) {
        dialog.showErrorBox('Invalid web service', 'The URL did not reference an existing web service.\n\n' +
            uri);
        return;
    }

    const windowid = data.nsoAccount.user.nsaId + ':' + webservice.id;

    if (windows.has(windowid)) {
        const window = windows.get(windowid)!;
        window.focus();
        return;
    }

    return openWebService(store, selected_user[0], nso, data, webservice, new URL(uri).search.substr(1));
}

function askUserForWebServiceUri(store: Store, uri: string) {
    return askUserForUri(store, uri, 'Select a user to open this web service');
}

export interface WebServiceData {
    webservice: WebService;
    url: string;
}

export class WebServiceIpc {
    constructor(
        store: Store
    ) {}

    private getWindowData(window: WebContents) {
        const data = windowapi.get(window);

        if (!data) {
            throw new Error('Unknown window');
        }

        return {
            store: data[0],
            token: data[1],
            nso: data[2],
            nintendoAccountToken: data[3].nintendoAccountToken,
            user: data[3].user,
            nsoAccount: data[3].nsoAccount,
            webservice: data[4],
        };
    }

    getWebService(event: IpcMainInvokeEvent): WebServiceData {
        const {user, webservice} = this.getWindowData(event.sender);

        const url = new URL(webservice.uri);
        url.search = new URLSearchParams({
            lang: user.language,
            na_country: user.country,
            na_lang: user.language,
        }).toString();

        return {
            webservice,
            url: url.toString(),
        };
    }

    async invokeNativeShare(event: IpcMainInvokeEvent, json: string): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        const data: NativeShareRequest = JSON.parse(json);

        debug('invokeNativeShare', webservice.name, nsoAccount.user.name, data);

        const texts: string[] = [];
        if (data.text) texts.push(data.text);
        if (data.hashtags) texts.push(data.hashtags.map(t => '#' + t).join(' '));

        const imagepath = await this.downloadShareImage(data);

        const menu = new ShareMenu({
            texts,
            filePaths: [imagepath],
        });

        menu.popup({window: BrowserWindow.fromWebContents(event.sender)!});
    }

    private async downloadShareImage(req: NativeShareRequest) {
        const dir = app.getPath('downloads');
        const basename = path.basename(new URL(req.image_url).pathname);
        const extname = path.extname(basename);
        let filename;
        let i = 0;

        do {
            i++;

            filename = i === 1 ? basename : basename.substr(0, basename.length - extname.length) + ' ' + i + extname;
        } while (await this.pathExists(path.join(dir, filename)));

        debug('Downloading image %s to %s as %s', req.image_url, dir, filename);

        const response = await fetch(req.image_url, {
            headers: {
                'User-Agent': '',
            },
        });
        const image = await response.arrayBuffer();
        await fs.writeFile(path.join(dir, filename), Buffer.from(image));

        return path.join(dir, filename);
    }

    private async pathExists(path: string) {
        try {
            await fs.access(path, constants.F_OK);
            return true;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
            return false;
        }
    }

    async invokeNativeShareUrl(event: IpcMainInvokeEvent, json: string): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        const data: NativeShareUrlRequest = JSON.parse(json);

        debug('invokeNativeShareUrl', webservice.name, nsoAccount.user.name, data);

        const menu = new ShareMenu({
            texts: [data.text],
            urls: [data.url],
        });

        menu.popup({window: BrowserWindow.fromWebContents(event.sender)!});
    }

    async requestGameWebToken(event: IpcMainInvokeEvent): Promise<string> {
        const {nso, nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called requestGameWebToken', webservice.name, nsoAccount.user.name);

        const webserviceToken = await nso.getWebServiceToken('' + webservice.id);

        return webserviceToken.accessToken;
    }

    async restorePersistentData(event: IpcMainInvokeEvent): Promise<string | undefined> {
        const {store, nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called restorePersistentData', webservice.name, nsoAccount.user.name);

        const key = 'WebServicePersistentData.' + nsoAccount.user.nsaId + '.' + webservice.id;
        const data: string | undefined = await store.storage.getItem(key);

        return data;
    }

    async storePersistentData(event: IpcMainInvokeEvent, data: string): Promise<void> {
        const {store, nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called storePersistentData', webservice.name, nsoAccount.user.name, data);

        const key = 'WebServicePersistentData.' + nsoAccount.user.nsaId + '.' + webservice.id;
        await store.storage.setItem(key, data);
    }

    async completeLoading(event: IpcMainInvokeEvent): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called completeLoading', webservice.name, nsoAccount.user.name);
    }
}
