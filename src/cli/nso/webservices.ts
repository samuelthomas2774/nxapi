import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:webservices');

export const command = 'webservices';
export const desc = 'List Nintendo Switch Online web services';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('json', {
        describe: 'Output raw JSON',
        type: 'boolean',
    }).option('json-pretty-print', {
        describe: 'Output pretty-printed JSON',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    console.warn('Listing web services');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [webservices, announcements, [friends, chats, activeevent, media, current_user]] = await Promise.all([
        nso.getWebServices(),
        nso.getAnnouncements(),

        data[Login] || true ? Promise.all([
            nso.getFriendList(),
            nso.getChats(),
            nso.getActiveEvent(),
            nso.getMedia(),
            nso.getCurrentUser(),
        ]) : [],
    ]);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(webservices, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(webservices));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Name',
            'Notifications',
            'URL',
        ],
    });

    for (const webservice of webservices) {
        table.push([
            webservice.id,
            webservice.name,
            webservice.isNotificationSupported ?
                webservice.isNotificationAllowed ? 'Allowed' : 'Not allowed' :
                'Not supported',
            webservice.uri,
        ]);
    }

    console.log(table.toString());
}
