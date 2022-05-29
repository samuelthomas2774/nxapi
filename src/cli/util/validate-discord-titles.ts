import process from 'node:process';
import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../util.js';
import { ArgumentsCamelCase } from '../../util/yargs.js';
import * as publishers from '../../discord/titles/index.js';

const debug = createDebug('cli:util:validate-discord-titles');
debug.enabled = true;

export const command = 'validate-discord-titles';
export const desc = 'Validate Discord title configuration';

type Arguments = ParentArguments;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const titles = [];
    let errors = 0;

    for (const [publisher, m] of Object.entries(publishers)) {
        if (!('titles' in m)) continue;

        let index = 0;
        let filtered = 0;
        const clients = new Set();
        const clients_filtered = new Set();
        const title_ids = new Set();

        for (const title of m.titles) {
            clients.add(title.client);
            const i = index++;

            if (title.id && title_ids.has(title.id)) {
                debug('[%s#%d] Duplicate title ID', publisher, i, title.id);
                errors++;
            }
            title_ids.add(title.id);

            let has_errors = false;
            const warn = (msg: string, ...args: any[]) => {
                has_errors = true;
                errors++;
                debug('[%s#%d] ' + msg, publisher, i, ...args);
            };

            if (!title.id.match(/^0100([0-9a-f]{8})[02468ace]000$/)) {
                if (title.id.match(/^0100([0-9a-f]{8})[02468ace]000$/i))
                    warn('Invalid title ID, must be lowercase hex', title.id);
                else warn('Invalid title ID', title.id);
            }
            if (!title.client.match(/^\d{18}$/)) warn('Invalid Discord client ID', title.id, title.client);

            if (has_errors) continue;

            titles.push(title);

            clients_filtered.add(title.client);
            filtered++;
        }

        if (clients.size !== clients_filtered.size) {
            debug('[%s] Loaded %d titles, using %d Discord clients (%d clients including invalid titles)',
                publisher, filtered, clients_filtered.size, clients.size);
        } else {
            debug('[%s] Loaded %d titles, using %d Discord clients',
                publisher, filtered, clients_filtered.size);
        }
    }

    debug('Loaded %d titles from %d publishers', titles.length,
        Object.values(publishers).filter(p => 'titles' in p).length);

    if (errors) {
        debug('Found %d issue' + (errors === 1 ? '' : 's'), errors);
        process.exit(1);
    }
}
