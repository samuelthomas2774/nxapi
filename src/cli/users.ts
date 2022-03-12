import createDebug from 'debug';
// @ts-expect-error
import Table from 'cli-table/lib/index.js';
import type { Arguments as ParentArguments } from '../cli.js';
import { Argv, initStorage, SavedToken } from '../util.js';

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
                'Nintendo Switch username',
            ],
        });

        for (const userid of users ?? []) {
            const token: string | undefined = await storage.getItem('NintendoAccountToken.' + userid);
            if (!token) continue;
            const cache: SavedToken | undefined = await storage.getItem('NsoToken.' + token);
            if (!cache) continue;

            table.push([
                cache.user.id + (selected === cache.user.id ? ' *' : ''),
                cache.user.screenName,
                cache.user.nickname,
                cache.user.country,
                cache.nsoAccount.user.name,
            ]);
        }

        if (!table.length) {
            console.log('No Nintendo Accounts');
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
            console.error('No session token for this user. Set a Nintendo Account session token by running `nintendo-znc token --select`.');
            throw new Error('Unknown user');
        }

        await storage.setItem('SelectedUser', argv.user);
    }).command('forget <user>', 'Removes all data for a Nintendo Account', yargs => {
        return yargs.positional('user', {
            describe: 'Nintendo Account ID',
            type: 'string',
            demandOption: true,
        });
    }, async argv => {
        const storage = await initStorage(argv.dataPath);

        const selected: string | undefined = await storage.getItem('SelectedUser');
        const token: string | undefined = await storage.getItem('NintendoAccountToken.' + argv.user);

        if (!token) {
            throw new Error('Unknown user');
        }

        if (selected === argv.user) {
            await storage.removeItem('SelectedUser');
            await storage.removeItem('SessionToken');
        }

        await storage.removeItem('NintendoAccountToken.' + argv.user);
        await storage.removeItem('NsoToken.' + token);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.delete(argv.user);
        await storage.setItem('NintendoAccountIds', [...users]);
    });
}
