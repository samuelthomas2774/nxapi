import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../util.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';

const debug = createDebug('cli:util:remote-config');

export const command = 'remote-config';
export const desc = 'Show nxapi remote configuration';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('json', {
        describe: 'Output raw JSON',
        type: 'boolean',
    }).option('json-pretty-print', {
        describe: 'Output pretty-printed JSON',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const { default: config } = await import('../../common/remote-config.js');

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(config, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(config));
        return;
    }

    console.log('Remote config', config);
}
