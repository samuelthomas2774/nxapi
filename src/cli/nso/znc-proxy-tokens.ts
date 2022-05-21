import createDebug from 'debug';
import fetch from 'node-fetch';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { getToken } from '../../common/auth/nso.js';
import { AuthPolicy, AuthToken } from './http-server.js';
import { Argv } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';

const debug = createDebug('cli:nso:znc-proxy-tokens');

export const command = 'znc-proxy-tokens <command>';
export const desc = 'Manage access tokens for `nxapi nso http-server`';

interface AuthTokens {
    tokens: ({
        token: string;
    } & AuthToken)[];
}

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).command('list', 'Lists access tokens', () => {}, async argv => {
        if (!argv.zncProxyUrl) {
            throw new Error('Requires --znc-proxy-url');
        }

        const storage = await initStorage(argv.dataPath);

        const usernsid = argv.user ?? await storage.getItem('SelectedUser');
        const token: string = argv.token ||
            await storage.getItem('NintendoAccountToken.' + usernsid);
        const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

        const tokens = await nso.fetch<AuthTokens>('/tokens');

        const table = new Table({
            head: [
                'Token',
                'Created at',
                'Access policy',
            ],
        });

        for (const auth of tokens.tokens) {
            table.push([
                auth.token,
                new Date(auth.created_at * 1000).toISOString(),
                JSON.stringify(auth.policy, null, 2) ?? 'No policy',
            ]);
        }

        if (!table.length) {
            console.warn('No access tokens');
            return;
        }

        console.log(table.toString());
    }).command('create', 'Creates an access token', yargs => {
        return yargs.option('policy', {
            describe: 'Restrict allowed actions',
            type: 'boolean',
            default: true,
        }).option('policy-announcements', {
            describe: 'Allow access to /announcements',
            type: 'boolean',
            default: false,
        }).option('policy-list-friends', {
            describe: 'Allow access to /friends',
            type: 'boolean',
            default: false,
        }).option('policy-list-friends-presence', {
            describe: 'Allow access to /friends/presence',
            type: 'boolean',
            default: false,
        }).option('policy-friend', {
            describe: 'Allow access to /friend/:id',
            type: 'boolean',
            default: false,
        }).option('policy-friend-presence', {
            describe: 'Allow access to /friend/:id/presence',
            type: 'boolean',
            default: false,
        }).option('policy-webservices', {
            describe: 'Allow access to /webservices',
            type: 'boolean',
            default: false,
        }).option('policy-activeevent', {
            describe: 'Allow access to /activeevent',
            type: 'boolean',
            default: false,
        }).option('policy-user', {
            describe: 'Allow access to /user',
            type: 'boolean',
            default: false,
        }).option('policy-user-presence', {
            describe: 'Allow access to /user/presence',
            type: 'boolean',
            default: false,
        }).option('policy-friends', {
            describe: 'Restrict friends to listed Nintendo Switch account IDs',
            type: 'array',
        }).option('policy-friends-presence', {
            describe: 'Restrict friends to listed Nintendo Switch account IDs for presence only',
            type: 'array',
        });
    }, async argv => {
        if (!argv.zncProxyUrl) {
            throw new Error('Requires --znc-proxy-url');
        }

        const storage = await initStorage(argv.dataPath);

        const usernsid = argv.user ?? await storage.getItem('SelectedUser');
        const token: string = argv.token ||
            await storage.getItem('NintendoAccountToken.' + usernsid);
        const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

        const policy: AuthPolicy | null = argv.policy ? {
            announcements: argv.policyAnnouncements,
            list_friends: argv.policyListFriends,
            list_friends_presence: argv.policyListFriendsPresence,
            friend: argv.policyFriend,
            friend_presence: argv.policyFriendPresence,
            webservices: argv.policyWebservices,
            activeevent: argv.policyActiveevent,
            current_user: argv.policyUser,
            current_user_presence: argv.policyUserPresence,

            friends: argv.policyFriends as string[] | undefined,
            friends_presence: argv.policyFriendsPresence as string[] | undefined,
        } : null;

        const auth = await nso.fetch<{token: string;} & AuthToken>('/tokens', 'POST', JSON.stringify({policy}), {
            'Content-Type': 'application/json',
        });

        console.warn('Created access token', auth);
        console.log(auth.token);
    }).command('revoke <token>', 'Deletes an access tokens', yargs => {
        return yargs.positional('token', {
            describe: 'Access token to delete',
            type: 'string',
            demandOption: true,
        });
    }, async argv => {
        if (!argv.zncProxyUrl) {
            throw new Error('Requires --znc-proxy-url');
        }

        const response = await fetch(argv.zncProxyUrl + '/token', {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + argv.token,
            },
        });
        debug('fetch %s %s, response %d', 'DELETE', '/token', response.status);

        if (response.status !== 204) {
            throw new Error('Unknown error ' + response.status);
        }

        console.warn('Deleted access token');
    });
}
