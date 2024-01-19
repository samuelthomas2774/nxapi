import { PresencePermissions } from '../../api/coral-types.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:permissions');

export const command = 'permissions';
export const desc = 'Get or update Nintendo Switch presence permissions';

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
    }).option('presence', {
        describe: 'New presence permission',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presence && !['FRIENDS', 'FAVORITE_FRIENDS', 'SELF'].includes(argv.presence)) {
        throw new Error('Invalid permissions');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    if (data[Login]) {
        const announcements = await nso.getAnnouncements();
        const friends = await nso.getFriendList();
        const webservices = await nso.getWebServices();
        const activeevent = await nso.getActiveEvent();
    }

    const permissions = await nso.getCurrentUserPermissions();

    if (argv.presence) {
        await nso.updateCurrentUserPermissions(argv.presence as PresencePermissions,
            permissions.permissions.presence, permissions.etag);
    } else {
        if (argv.jsonPrettyPrint) {
            console.log(JSON.stringify(permissions, null, 4));
            return;
        }
        if (argv.json) {
            console.log(JSON.stringify(permissions));
            return;
        }

        console.log('Presence is visible to %s', permissions.permissions.presence);
    }
}
