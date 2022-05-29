import * as path from 'path';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import { Buffer } from 'buffer';
import createDebug from 'debug';
import { app, BrowserWindow, IpcMainInvokeEvent, session, ShareMenu, shell, WebContents } from './electron.js';
import fetch from 'node-fetch';
import ZncApi from '../../api/znc.js';
import { dev } from '../../util/product.js';
import { WebService } from '../../api/znc-types.js';
import { bundlepath, Store } from './index.js';
import type { NativeShareRequest, NativeShareUrlRequest } from '../preload-webservice/znca-js-api.js';
import { SavedToken } from '../../common/auth/nso.js';

const debug = createDebug('app:main:webservices');

export function createWebServiceWindow(nsa_id: string, webservice: WebService) {
    const browser_session = session.fromPartition('persist:webservices-' + nsa_id, {
        cache: false,
    });

    const window = new BrowserWindow({
        width: 375,
        height: 667,
        resizable: false,
        title: webservice.name,
        webPreferences: {
            session: browser_session,
            preload: path.join(bundlepath, 'preload-webservice.cjs'),
            contextIsolation: false,
            scrollBounce: true,
        },
    });

    return window;
}

const windows = new Map<string, BrowserWindow>();
const windowapi = new WeakMap<WebContents, [Store, string, ZncApi, SavedToken, WebService]>();

export default async function openWebService(
    store: Store, token: string, nso: ZncApi, data: SavedToken, webservice: WebService
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

    const window = createWebServiceWindow(data.nsoAccount.user.nsaId, webservice);

    windows.set(windowid, window);
    windowapi.set(window.webContents, [store, token, nso, data, webservice]);

    window.on('closed', () => {
        windows.delete(windowid);
        // windowapi.delete(window.webContents);
    });

    window.webContents.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';

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

    debug('Loading web service', {
        url: url.toString(),
        webservice,
        webserviceToken,
    });

    if (dev) window.webContents.openDevTools();

    window.loadURL(url.toString(), {
        extraHeaders: Object.entries({
            'x-gamewebtoken': webserviceToken.result.accessToken,
            'dnt': '1',
            'X-Requested-With': 'com.nintendo.znca',
        }).map(([key, value]) => key + ': ' + value).join('\n'),
    });
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

        const response = await fetch(req.image_url);
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
        // TODO: if the web service token has expired the NSO app token will probably have expired as well
        // This needs to renew that token if necessary

        const {nso, nsoAccount, webservice} = this.getWindowData(event.sender);

        debug('Web service %s, user %s, called requestGameWebToken', webservice.name, nsoAccount.user.name);

        const webserviceToken = await nso.getWebServiceToken('' + webservice.id);

        return webserviceToken.result.accessToken;
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
}
