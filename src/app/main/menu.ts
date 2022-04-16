import { app, dialog, Menu, Tray, nativeImage, MenuItem } from '../electron.js';
import { addNsoAccount, addPctlAccount } from './na-auth.js';
import { Store } from './index.js';
import { getToken, SavedMoonToken, SavedToken } from '../../util.js';
import { WebService } from '../../api/znc-types.js';
import openWebService from './webservices.js';

export default class MenuApp {
    tray: Tray;

    constructor(readonly store: Store) {
        const icon = nativeImage.createEmpty();

        this.tray = new Tray(icon);

        this.tray.setTitle('nxapi');
        this.tray.setToolTip('nxapi');

        store.on('update-nintendo-accounts', () => this.updateMenu());
        this.updateMenu();
    }

    async updateMenu() {
        const menu = new Menu();
        const ids = await this.store.storage.getItem('NintendoAccountIds') as string[] | undefined;
        menu.append(new MenuItem({label: 'Nintendo Switch Online', enabled: false}));

        for (const id of ids ?? []) {
            const token = await this.store.storage.getItem('NintendoAccountToken.' + id) as string | undefined;
            if (!token) continue;
            const data = await this.store.storage.getItem('NsoToken.' + token) as SavedToken | undefined;
            if (!data) continue;

            const item = new MenuItem({
                label: data.nsoAccount.user.name,
                submenu: [
                    {label: 'Nintendo Account ID: ' + data.user.id, enabled: false},
                    {label: 'NSA ID: ' + data.nsoAccount.user.nsaId, enabled: false},
                    {type: 'separator'},
                    {label: 'Web services', enabled: false},
                    ...await this.getWebServiceItems(token) as any,
                ],
            });

            menu.append(item);
        }

        menu.append(new MenuItem({label: 'Add account', click: this.addNsoAccount}));
        menu.append(new MenuItem({type: 'separator'}));
        menu.append(new MenuItem({label: 'Nintendo Switch Parental Controls', enabled: false}));

        for (const id of ids ?? []) {
            const token = await this.store.storage.getItem('NintendoAccountToken-pctl.' + id) as string | undefined;
            if (!token) continue;
            const data = await this.store.storage.getItem('MoonToken.' + token) as SavedMoonToken | undefined;
            if (!data) continue;

            const item = new MenuItem({
                label: data.user.nickname,
                submenu: [
                    {label: 'Nintendo Account ID: ' + data.user.id, enabled: false},
                ],
            });

            menu.append(item);
        }

        menu.append(new MenuItem({label: 'Add account', click: this.addPctlAccount}));

        menu.append(new MenuItem({type: 'separator'}));
        menu.append(new MenuItem({label: 'Quit', click: () => app.quit()}));

        this.tray.setContextMenu(menu);
    }

    addNsoAccount = () => {
        addNsoAccount(this.store.storage).catch(err => {
            if (err.message === 'Canceled') return;

            dialog.showErrorBox('Error adding account', err.stack || err.message);
        });
    };

    addPctlAccount = () => {
        addPctlAccount(this.store.storage).catch(err => {
            if (err.message === 'Canceled') return;

            dialog.showErrorBox('Error adding account', err.stack || err.message);
        });
    };

    // Hardcode these temporarily until they are cached
    webservices: WebService[] | null = [
        {
            id: 4953919198265344,
            uri: 'https://web.sd.lp1.acbaa.srv.nintendo.net',
            customAttributes: [
                {attrKey: 'verifyMembership', attrValue: 'true'},
                {attrKey: 'deepLinkingEnabled', attrValue: 'true'},
                {attrKey: 'appNavigationBarBgColor', attrValue: '82D7AA'},
                {attrKey: 'appStatusBarBgColor', attrValue: '82D7AA'},
            ],
            whiteList: ['*.acbaa.srv.nintendo.net'],
            name: 'Animal Crossing: New Horizons',
            imageUri: 'https://cdn.znc.srv.nintendo.net/gameWebServices/n5b4648f/n5b4648f/images/euEn/banner.png',
        },
        {
            id: 5598642853249024,
            uri: 'https://app.smashbros.nintendo.net',
            customAttributes: [
                {attrKey: 'verifyMembership', attrValue: 'true'},
                {attrKey: 'appNavigationBarBgColor', attrValue: 'A50514'},
                {attrKey: 'appStatusBarBgColor', attrValue: 'A50514'},
            ],
            whiteList: ['app.smashbros.nintendo.net'],
            name: 'Super Smash Bros. Ultimate',
            imageUri: 'https://cdn.znc.srv.nintendo.net/gameWebServices/n3f32691/n3f32691/images/euEn/banner.png',
        },
        {
            id: 5741031244955648,
            uri: 'https://app.splatoon2.nintendo.net/',
            customAttributes: [
                {attrKey: 'appNavigationBarBgColor', attrValue: 'E60012'},
                {attrKey: 'appStatusBarBgColor', attrValue: 'E60012'},
            ],
            whiteList: ['app.splatoon2.nintendo.net'],
            name: 'Splatoon 2',
            imageUri: 'https://cdn.znc.srv.nintendo.net/gameWebServices/splatoon2/images/euEn/banner.png',
        },
    ];

    async getWebServices(token: string) {
        if (this.webservices) return this.webservices;

        const {nso, data} = await getToken(this.store.storage, token, process.env.ZNC_PROXY_URL);

        const webservices = await nso.getWebServices();
        return this.webservices = webservices.result;
    }

    async getWebServiceItems(token: string) {
        const webservices = await this.getWebServices(token);
        const items = [];

        for (const webservice of webservices) {
            items.push(new MenuItem({
                label: webservice.name,
                click: async () => {
                    const {nso, data} = await getToken(this.store.storage, token, process.env.ZNC_PROXY_URL);

                    await openWebService(this.store, token, nso, data, webservice);
                },
            }));
        }

        return items;
    }
}
