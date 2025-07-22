import * as persist from 'node-persist';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../cli.js';
import createDebug from '../util/debug.js';
import { Argv } from '../util/yargs.js';
import { initStorage, iterateLocalStorage } from '../util/storage.js';
import { SavedToken } from '../common/auth/coral.js';
import { SavedMoonToken } from '../common/auth/moon.js';
import { Jwt } from '../util/jwt.js';
import { NintendoAccountSessionTokenJwtPayload } from '../api/na.js';

const debug = createDebug('cli:users');
const debugRemove = createDebug('cli:users:remove');
debugRemove.enabled = true;

export const command = 'users <command>';
export const desc = 'Manage authenticated Nintendo Accounts';

interface AppSavedMonitorState {
    users: {id: string;}[];
    discord_presence: {source: {na_id: string;};} | null;
}

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.command('list', 'Lists known Nintendo Accounts', () => {}, async argv => {
        const storage = await initStorage(argv.dataPath);

        const users: string[] | undefined = await storage.getItem('NintendoAccountIds');
        const selected: string | undefined = await storage.getItem('SelectedUser');

        const table = new Table({
            head: [
                'ID',
                'Screen name',
                'Nickname',
                'Country',
                'NSA ID',
                'Nintendo Switch username',
                'Parental Controls',
            ],
        });

        for (const userid of users ?? []) {
            const token: string | undefined = await storage.getItem('NintendoAccountToken.' + userid);
            const nsoCache: SavedToken | undefined = token ? await storage.getItem('NsoToken.' + token) : undefined;
            const moonToken: string | undefined = await storage.getItem('NintendoAccountToken-pctl.' + userid);
            const moonCache: SavedMoonToken | undefined = moonToken ? await storage.getItem('MoonToken.' + moonToken) : undefined;

            const user = nsoCache?.user ?? moonCache?.user;
            if (!user) continue;

            table.push([
                user.id + (selected === user.id ? ' *' : ''),
                user.screenName ?? 'Unknown',
                user.nickname,
                user.country,
                nsoCache?.nsoAccount.user.nsaId ?? 'Not signed in',
                nsoCache?.nsoAccount.user.name ?? 'Not signed in',
                moonCache ? 'Signed in' : 'Not signed in',
            ]);
        }

        if (!table.length) {
            console.warn('No Nintendo Accounts');
            return;
        }

        console.log(table.toString());
    }).command('set <user>', 'Sets the default Nintendo Account', yargs => {
        return yargs.positional('user', {
            describe: 'Nintendo Account ID',
            type: 'string',
            demandOption: true,
        });
    }, async argv => {
        const storage = await initStorage(argv.dataPath);

        const token: string | undefined = await storage.getItem('NintendoAccountToken.' + argv.user);

        if (!token) {
            console.error('No session token for this user. Set a Nintendo Account session token by running `nxapi nso token --select` or `nxapi pctl token --select`.');
            throw new Error('Unknown user');
        }

        await storage.setItem('SelectedUser', argv.user);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(argv.user);
        await storage.setItem('NintendoAccountIds', [...users]);
    }).command('forget <user>', 'Removes all data for a Nintendo Account', yargs => {
        return yargs.positional('user', {
            describe: 'Nintendo Account ID',
            type: 'string',
            demandOption: true,
        });
    }, async argv => {
        const storage = await initStorage(argv.dataPath);

        const nsoToken: string | undefined = await storage.getItem('NintendoAccountToken.' + argv.user);
        const nsoCache: SavedToken | undefined = nsoToken ? await storage.getItem('NsoToken.' + nsoToken) : undefined;

        await removeUserData(storage, argv.user);

        console.log('Removed %s%s from storage', argv.user,
            nsoCache ? ' (' + nsoCache.user.nickname + '/' + nsoCache.nsoAccount.user.name + ')' : '');
        console.log('Additional cached data about this user may still exist in nxapi\'s storage. Use `nxapi util storage list` to list all data stored with node-persist.');
    });
}

async function removeUserData(
    storage: persist.LocalStorage, na_id: string,
    only?: ('coral' | 'moon')[], only_cached = false
) {
    let coral_saved_token: SavedToken | undefined = undefined;

    for await (const {key, value} of iterateLocalStorage(storage)) {
        if (key.startsWith('NsoToken.') && (!only || only.includes('coral'))) {
            const session_token = key.substr(9);
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(session_token);
            if (jwt.payload.sub !== na_id) continue;

            if (!coral_saved_token) coral_saved_token = value;

            debugRemove('Removing data for coral session token', session_token);
            await removeSavedCoralTokenData(storage, session_token);
        }

        if (key.startsWith('MoonToken.') && (!only || only.includes('moon'))) {
            const session_token = key.substr(9);
            const [jwt, sig] = Jwt.decode<NintendoAccountSessionTokenJwtPayload>(session_token);
            if (jwt.payload.sub !== na_id) continue;

            debugRemove('Removing data for moon session token', session_token);
            await removeSavedMoonTokenData(storage, session_token);
        }
    }

    if (coral_saved_token && (!only || only.includes('coral'))) {
        for await (const {key} of iterateLocalStorage(storage)) {
            if (key.startsWith('WebServicePersistentData.' + coral_saved_token.nsoAccount.user.nsaId + '.')) {
                debugRemove('Removing web service persisted data', key.substr(25));
                await storage.removeItem(key);
            }
        }
    }

    const selected: string | undefined = await storage.getItem('SelectedUser');
    let coral_session_token: string | undefined = await storage.getItem('NintendoAccountToken.' + na_id);
    let moon_session_token: string | undefined = await storage.getItem('NintendoAccountToken-pctl.' + na_id);

    if (coral_session_token && (!only || only.includes('coral')) && !only_cached) {
        debugRemove('Removing coral session token');
        await storage.removeItem('NintendoAccountToken.' + na_id);

        const app_monitors: AppSavedMonitorState | undefined = await storage.getItem('AppMonitors');
        if (app_monitors) {
            app_monitors.users = app_monitors.users.filter(u => u.id !== na_id);
            if (app_monitors.discord_presence?.source.na_id === na_id) app_monitors.discord_presence = null;
            await storage.setItem('AppMonitors', app_monitors);
        }

        coral_session_token = undefined;
    }

    if (moon_session_token && (!only || only.includes('moon')) && !only_cached) {
        debugRemove('Removing moon session token');
        await storage.removeItem('NintendoAccountToken-pctl.' + na_id);
        moon_session_token = undefined;
    }

    if (!coral_session_token && !moon_session_token && selected === na_id) {
        debugRemove('Deselecting user');
        await storage.removeItem('SelectedUser');
        await storage.removeItem('SessionToken');
    }

    const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
    if (!coral_session_token && !moon_session_token && users.has(na_id)) {
        debugRemove('Removing user from list');
        users.delete(na_id);
        await storage.setItem('NintendoAccountIds', [...users]);
    }
}

async function removeSavedCoralTokenData(storage: persist.LocalStorage, session_token: string) {
    await storage.removeItem('SessionToken');

    await storage.removeItem('IksmToken.' + session_token);
    await storage.removeItem('NookToken.' + session_token);
    await storage.removeItem('NookUsers.' + session_token);
    await storage.removeItem('BulletToken.' + session_token);

    for await (const {key, value} of iterateLocalStorage(storage)) {
        if (key.startsWith('NookAuthToken.' + session_token + '.')) await storage.removeItem(key);

        if (value === session_token) await storage.removeItem(key);
    }
}

async function removeSavedMoonTokenData(storage: persist.LocalStorage, session_token: string) {
    await storage.removeItem('MoonToken.' + session_token);
}
