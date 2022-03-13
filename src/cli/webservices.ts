import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../util.js';

const debug = createDebug('cli:announcements');

export const command = 'webservices';
export const desc = 'List Nintendo Switch Online web services';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    console.log('Listing web services');

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

    const table = new Table({
        head: [
            'ID',
            'Name',
            'URL',
        ],
    });

    for (const webservice of webservices.result) {
        table.push([
            webservice.id,
            webservice.name,
            webservice.uri,
        ]);
    }

    console.log(table.toString());
}
