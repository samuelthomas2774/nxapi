import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../../cli.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getPctlToken } from './util.js';

const debug = createDebug('cli:pctl:devices');

export const command = 'devices';
export const desc = 'List Nintendo Switch consoles';

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
    console.warn('Listing devices');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken-pctl.' + usernsid);
    const {moon, data} = await getPctlToken(storage, token);

    const devices = await moon.getDevices();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(devices, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(devices));
        return;
    }

    const table = new Table({
        head: [
            'ID',
            'Label',
            'Serial number',
            'Software version',
            'PIN',
            'Last synchronised',
        ],
    });

    for (const device of devices.items) {
        table.push([
            device.deviceId,
            device.label,
            device.device.serialNumber,
            device.device.firmwareVersion.displayedVersion + ' (' + device.device.firmwareVersion.internalVersion + ')',
            device.device.synchronizedUnlockCode,
            new Date(device.device.synchronizedParentalControlSetting.synchronizedAt * 1000).toISOString(),
        ]);
    }

    console.log(table.toString());
}
