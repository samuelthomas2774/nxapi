import createDebug from 'debug';
import { BrowserWindow, session, shell } from '../electron.js';
import ZncApi from '../../api/znc.js';
import { SavedToken } from '../../util.js';
import { WebService } from '../../api/znc-types.js';

const debug = createDebug('app:main:webservices');

export function createWebServiceWindow(na_id: string, webservice: WebService) {
    const browser_session = session.fromPartition('webservices-' + na_id, {
        cache: false,
    });

    const window = new BrowserWindow({
        width: 375,
        height: 667,
        resizable: false,
        title: webservice.name,
        webPreferences: {
            session: browser_session,
            scrollBounce: true,
        },
    });

    return window;
}

const windows = new Map<string, BrowserWindow>();

export default async function openWebService(nso: ZncApi, data: SavedToken, webservice: WebService) {
    const windowid = data.user.id + ':' + webservice.id;

    if (windows.has(windowid)) {
        const window = windows.get(windowid)!;

        window.focus();

        return;
    }

    const window = createWebServiceWindow(data.user.id, webservice);

    window.on('closed', () => {
        windows.delete(windowid);
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

    window.webContents.openDevTools();

    window.loadURL(url.toString(), {
        extraHeaders: Object.entries({
            'x-gamewebtoken': webserviceToken.result.accessToken,
            'dnt': '1',
            'X-Requested-With': 'com.nintendo.znca',
        }).map(([key, value]) => key + ': ' + value).join('\n'),
    });
}
