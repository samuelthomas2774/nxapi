import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../../cli.js';
import { ArgumentsCamelCase, Argv, getPctlToken, initStorage, YargsArguments } from '../../util.js';

const debug = createDebug('cli:pctl:settings');

export const command = 'settings <device>';
export const desc = 'Show parental control setting state';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('device', {
        describe: 'Nintendo Switch device ID',
        type: 'string',
        demandOption: true,
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken-pctl.' + usernsid);
    const {moon, data} = await getPctlToken(storage, token);

    const d = await moon.getParentalControlSettingState(argv.device);

    console.log(d);
}
