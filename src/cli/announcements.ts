import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../util.js';

const debug = createDebug('cli:announcements');

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
        await storage.getItem('NintendoAccountToken.' + usernsid) ||
        await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const announcements = await nso.getAnnouncements();
    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(announcements.result, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(announcements.result));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Title',
            'Priority',
            'Date',
            'Display end date',
        ],
    });

    for (const announcement of announcements.result) {
        table.push([
            announcement.announcementId,
            announcement.title.substr(0, 60),
            announcement.priority,
            new Date(announcement.distributionDate * 1000).toISOString(),
            new Date(announcement.forceDisplayEndDate * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
}
