import createDebug from 'debug';
import Table from './util/table.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { Argv } from '../util/yargs.js';
import { initStorage } from '../util/storage.js';
import { SavedToken } from '../common/auth/nso.js';
import { SavedMoonToken } from '../common/auth/moon.js';

const debug = createDebug('cli:users');

export const command = 'users <command>';
export const desc = 'Manage authenticated Nintendo Accounts';

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
                user.screenName,
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

        const selected: string | undefined = await storage.getItem('SelectedUser');
        const nsoToken: string | undefined = await storage.getItem('NintendoAccountToken.' + argv.user);
        const nsoCache: SavedToken | undefined = nsoToken ? await storage.getItem('NsoToken.' + nsoToken) : undefined;
        const moonToken: string | undefined = await storage.getItem('NintendoAccountToken-pctl.' + argv.user);

        if (!nsoToken && !moonToken) {
            throw new Error('Unknown user');
        }

        if (selected === argv.user) {
            await storage.removeItem('SelectedUser');
            await storage.removeItem('SessionToken');
        }

        await storage.removeItem('IksmToken.' + nsoToken);
        await storage.removeItem('NookToken.' + nsoToken);
        await storage.removeItem('NookUsers.' + nsoToken);

        for (const key of await storage.keys()) {
            if (key.startsWith('NookAuthToken.' + nsoToken + '.')) await storage.removeItem(key);
            if (nsoCache && key.startsWith('WebServicePersistentData.' + nsoCache.nsoAccount.user.nsaId + '.'))
                await storage.removeItem(key);
        }

        await storage.removeItem('NintendoAccountToken.' + argv.user);
        await storage.removeItem('NsoToken.' + nsoToken);
        await storage.removeItem('NintendoAccountToken-pctl.' + argv.user);
        await storage.removeItem('MoonToken.' + moonToken);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.delete(argv.user);
        await storage.setItem('NintendoAccountIds', [...users]);
    });
}
