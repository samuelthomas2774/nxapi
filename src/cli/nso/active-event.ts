import type { Arguments as ParentArguments } from '../nso.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:active-event');

export const command = 'active-event';
export const desc = 'Show the user\'s current Online Lounge/voice chat event';

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
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    if (data[Login]) {
        const announcements = await nso.getAnnouncements();
    }

    const webservices = await nso.getWebServices();
    const friends = await nso.getFriendList();
    const activeevent = await nso.getActiveEvent();

    if ('id' in activeevent) {
        if (argv.jsonPrettyPrint) {
            console.log(JSON.stringify(activeevent, null, 4));
            return;
        }
        if (argv.json) {
            console.log(JSON.stringify(activeevent));
            return;
        }

        console.log('Active event', activeevent);
    } else {
        if (argv.json || argv.jsonPrettyPrint) {
            console.log('null');
            return;
        }

        console.log('No active event');
    }
}
