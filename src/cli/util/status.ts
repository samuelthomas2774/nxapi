import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { StatusUpdateMonitor } from '../../common/status.js';

const debug = createDebug('cli:util:status');

export const command = 'status';
export const desc = 'Show nxapi service status updates';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('url', {
        describe: 'Additional status update source',
        type: 'array',
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
    // const { default: config } = await import('../../common/remote-config.js');

    const status = new StatusUpdateMonitor();

    for (const url of argv.url ?? []) {
        status.addSource(url.toString());
    }

    const result = await status.checkStatusUpdates();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(result, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(result));
        return;
    }

    console.log('Status updates', result);
}
