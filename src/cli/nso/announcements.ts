import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:announcements');

export const command = 'announcements';
export const desc = 'List Nintendo Switch Online app announcements';

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
    console.warn('Listing announcements');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [announcements, webservices, [friends, chats, activeevent, media, current_user]] = await Promise.all([
        nso.getAnnouncements(),
        nso.getWebServices(),

        data[Login] || true ? Promise.all([
            nso.getFriendList(),
            nso.getChats(),
            nso.getActiveEvent(),
            nso.getMedia(),
            nso.getCurrentUser(),
        ]) : [],
    ]);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(announcements, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(announcements));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Type',
            'Title',
            'Contents',
            'Date',
        ],
    });

    for (const announcement of announcements) {
        table.push([
            announcement.id,
            announcement.type,
            announcement.title.substr(0, 60),
            'operation' in announcement ? announcement.operation.contents.substr(0, 40) + '...' :
                'friendRequest' in announcement ? 'NSA ID: ' + announcement.friendRequest.nsaId : '',
            new Date(announcement.deliversAt * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
}
