import { app, BrowserWindow, clipboard, dialog, IpcMainInvokeEvent, nativeImage, nativeTheme, Notification, ShareMenu, shell, WebContents } from 'electron';
import * as path from 'node:path';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import * as util from 'node:util';
import { fetch } from 'undici';
import { Store } from './index.js';
import { createWebServiceWindow } from './windows.js';
import { askUserForUri, showErrorDialog } from './util.js';
import type { DownloadImagesRequest, NativeShareRequest, NativeShareUrlRequest, QrCodeReaderCameraOptions, QrCodeReaderCheckinOptions, QrCodeReaderCheckinResult, QrCodeReaderPhotoLibraryOptions, SendMessageOptions } from '../preload-webservice/znca-js-api.js';
import createDebug from '../../util/debug.js';
import { CoralApiInterface, CoralAuthData } from '../../api/coral.js';
import { WebService, WebServiceToken } from '../../api/coral-types.js';
import { SavedToken } from '../../common/auth/coral.js';
import { checkMembershipActive } from '../../common/auth/util.js';

const debug = createDebug('app:main:webservices');

const windows = new Map<string, BrowserWindow>();
const windowapi = new WeakMap<WebContents, [Store, string, CoralApiInterface, SavedToken, WebService]>();

export default async function openWebService(
    store: Store, token: string, coral: CoralApiInterface, data: SavedToken,
    webservice: WebService, qs?: string
) {
    const windowid = data.nsoAccount.user.nsaId + ':' + webservice.id;

    if (windows.has(windowid)) {
        const window = windows.get(windowid)!;

        window.focus();

        const deepLinkingEnabled = webservice.customAttributes.find(a => a.attrKey === 'deepLinkingEnabled');

        if (deepLinkingEnabled?.attrValue === 'true' && qs) {
            window.webContents.send('nxapi:webserviceapi:deeplink', qs);
        }

        return;
    }

    const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');
    if (verifymembership?.attrValue === 'true') checkMembershipActive(data);

    const user_title_prefix = '[' + data.user.nickname +
        (data.nsoAccount.user.name !== data.user.nickname ? '/' + data.nsoAccount.user.name : '') + '] ';

    const window = createWebServiceWindow(data.nsoAccount.user.nsaId, webservice, user_title_prefix);

    windows.set(windowid, window);
    windowapi.set(window.webContents, [store, token, coral, data, webservice]);

    window.on('closed', () => {
        windows.delete(windowid);
        // windowapi.delete(window.webContents);
    });

    window.webContents.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';

    window.webContents.on('will-navigate', (event, url) => {
        debug('Web service will navigate', webservice.uri, webservice.whiteList, url);

        if (!isWebServiceUrlAllowed(webservice, url)) {
            debug('Web service attempted to navigate to a URL not allowed by it\'s `whiteList`', webservice, url);
            debug('open', url);
            shell.openExternal(url);
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

    const webserviceToken = await getWebServiceToken(coral, webservice, qs, data, window);

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

    window.loadURL(url.toString(), {
        extraHeaders: Object.entries({
            'x-appcolorscheme': nativeTheme.shouldUseDarkColors ? 'DARK' : 'LIGHT',
            'x-gamewebtoken': webserviceToken.accessToken,
            'dnt': '1',
            'X-Requested-With': 'com.nintendo.znca',
        }).map(([key, value]) => key + ': ' + value).join('\n'),
    });
}

export class WebServiceValidationError extends Error {}

async function getWebServiceToken(
    coral: CoralApiInterface,
    webservice: WebService, qs: string | undefined,
    auth_data: CoralAuthData,
    window: BrowserWindow,
): Promise<WebServiceToken> {
    try {
        return await coral.getWebServiceToken(webservice.id);
    } catch (err) {
        const result = await handleOpenWebServiceError(err, webservice, qs, auth_data, window,
            ['Retry', 'Close ' + webservice.name, 'Ignore']);

        if (result.response === 0) {
            return getWebServiceToken(coral, webservice, qs, auth_data, window);
        }
        if (result.response === 1) {
            window.close();
            throw new Error('Error requesting web service token, closing web service');
        }

        throw err;
    }
}

function isWebServiceUrlAllowed(webservice: WebService, url: string | URL) {
    if (!webservice.whiteList) return true;

    if (typeof url === 'string') url = new URL(url);

    for (const allowed of webservice.whiteList) {
        const host = allowed.includes('/') ? allowed.substr(0, allowed.indexOf('/')) : allowed;
        const path = allowed.includes('/') ? allowed.substr(allowed.indexOf('/')) : null;

        if (path && url.pathname !== path && !url.pathname.startsWith(path + '/')) continue;

        if (host.startsWith('*.')) {
            if (url.hostname === host.substr(2) ||
                url.hostname.endsWith(host.substr(1))
            ) return true;
        }

        if (url.hostname === host) return true;
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

    return openWebService(store, selected_user[0], nso, data, webservice, new URL(uri).search.substr(1));
}

function askUserForWebServiceUri(store: Store, uri: string) {
    return askUserForUri(store, uri, 'Select a user to open this web service');
}

export async function handleOpenWebServiceError(
    err: unknown,
    webservice: WebService, qs?: string, auth_data?: CoralAuthData,
    window?: BrowserWindow, buttons?: string[],
) {
    const data = {
        webservice: {
            id: webservice.id,
            name: webservice.name,
            uri: webservice.uri,
        },
        qs,
        user_na_id: auth_data?.user.id,
        user_nsa_id: auth_data?.nsoAccount.user.nsaId,
        user_coral_id: auth_data?.nsoAccount.user.id,
    };

    return showErrorDialog({
        message: (err instanceof Error ? err.name : 'Error') + ' opening web service',
        error: err,
        detail: util.inspect(data, {compact: true}),
        buttons,
        window,
    });
}

export interface WebServiceData {
    webservice: WebService;
    url: string;
}

export interface QrCodeReaderOptions {
    type: 'camera' | 'photolibrary' | 'checkin';
    data: string;
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
            data: data[3],
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

        const imagepath = await this.downloadShareImage(data.image_url);

        const menu = new ShareMenu({
            texts,
            filePaths: [imagepath],
        });

        menu.popup({window: BrowserWindow.fromWebContents(event.sender)!});
    }

    private async downloadShareImage(image_url: string) {
        const dir = app.getPath('downloads');
        const basename = path.basename(new URL(image_url).pathname);
        const extname = path.extname(basename);
        let filename;
        let i = 0;

        do {
            i++;

            filename = i === 1 ? basename : basename.substr(0, basename.length - extname.length) + ' ' + i + extname;
        } while (await this.pathExists(path.join(dir, filename)));

        debug('Downloading image %s to %s as %s', image_url, dir, filename);

        const response = await fetch(image_url, {
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
        const {nso, data, nsoAccount, webservice} = this.getWindowData(event.sender);
        const window = BrowserWindow.fromWebContents(event.sender)!;

        debug('Web service %s, user %s, called requestGameWebToken', webservice.name, nsoAccount.user.name);

        const webserviceToken = await getWebServiceToken(nso, webservice, undefined, data, window);

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

    async openQrCodeReader(event: IpcMainInvokeEvent, options: QrCodeReaderOptions): Promise<string> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('openQrCodeReader', webservice.name, nsoAccount.user.name, options);

        if (options.type === 'checkin') {
            const request: QrCodeReaderCheckinOptions = JSON.parse(options.data);

            const result: QrCodeReaderCheckinResult = {
                status: 'ERROR',
                text: null,
            };

            return JSON.stringify(result);
        }

        // camera/photolibrary
        const request: QrCodeReaderCameraOptions | QrCodeReaderPhotoLibraryOptions = JSON.parse(options.data);

        return '';
    }

    async closeQrCodeReader(event: IpcMainInvokeEvent): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('closeQrCodeReader', webservice.name, nsoAccount.user.name);

        //
    }

    async sendMessage(event: IpcMainInvokeEvent, json: string): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        const data: SendMessageOptions = JSON.parse(json);

        debug('sendMessage', webservice.name, nsoAccount.user.name, data);

        if (data.type === 'B_SHOW_SUCCESS') {
            dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender)!, {
                message: data.message,
            });
        } else if (data.type === 'B_SHOW_ERROR') {
            dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender)!, {
                type: 'error',
                message: data.message,
            });
        } else {
            debug('Unsupported message type', data.type);
        }
    }

    async copyToClipboard(event: IpcMainInvokeEvent, data: string): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('copyToClipboard', webservice.name, nsoAccount.user.name, data);

        clipboard.writeText(data);
    }

    async downloadImages(event: IpcMainInvokeEvent, json: string): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        const data: DownloadImagesRequest = JSON.parse(json);

        debug('downloadImages', webservice.name, nsoAccount.user.name, data);

        for (const url of data.image_urls) {
            const imagepath = await this.downloadShareImage(url);

            new Notification({
                title: 'Image saved from ' + webservice.name,
                body: 'Image downloaded to ' + imagepath,
                icon: nativeImage.createFromPath(imagepath),
            }).show();
        }
    }

    async completeLoading(event: IpcMainInvokeEvent): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called completeLoading', webservice.name, nsoAccount.user.name);
    }

    async clearUnreadFlag(event: IpcMainInvokeEvent): Promise<void> {
        const {nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called clearUnreadFlag', webservice.name, nsoAccount.user.name);
    }
}
