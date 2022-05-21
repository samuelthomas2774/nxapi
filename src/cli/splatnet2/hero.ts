import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet2.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getIksmToken } from '../../common/auth/splatnet2.js';

const debug = createDebug('cli:splatnet2:hero');

export const command = 'hero';
export const desc = 'Show hero (Octo Canyon) records';

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
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {splatnet} = await getIksmToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const hero = await splatnet.getHeroRecords();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(hero, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(hero));
        return;
    }

    console.log('Summary', hero.summary);

    const table = new Table({
        head: [
            'Mission',
            'Hero Shot',
            'Hero Roller',
            'Hero Charger',
            'Hero Dualies',
            'Hero Brella',
            'Hero Splatling',
            'Hero Blaster',
            'Hero Slosher',
            'Herobrush',
        ],
    });

    for (const stage of hero.stage_infos) {
        table.push([
            stage.stage.area + '-' + (stage.stage.is_boss ? 'B' : stage.stage.id),
            stage.clear_weapons[0] ? 'Level ' + stage.clear_weapons[0].weapon_level + ', ' +
                hrduration(stage.clear_weapons[0].clear_time) : '',
            stage.clear_weapons[1] ? hrduration(stage.clear_weapons[1].clear_time) : '',
            stage.clear_weapons[2] ? hrduration(stage.clear_weapons[2].clear_time) : '',
            stage.clear_weapons[3] ? hrduration(stage.clear_weapons[3].clear_time) : '',
            stage.clear_weapons[4] ? hrduration(stage.clear_weapons[4].clear_time) : '',
            stage.clear_weapons[5] ? hrduration(stage.clear_weapons[5].clear_time) : '',
            stage.clear_weapons[6] ? hrduration(stage.clear_weapons[6].clear_time) : '',
            stage.clear_weapons[7] ? hrduration(stage.clear_weapons[7].clear_time) : '',
            stage.clear_weapons[8] ? hrduration(stage.clear_weapons[8].clear_time) : '',
        ]);
    }

    console.log('Stages');
    console.log(table.toString());
}

function hrduration(duration: number) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration - (minutes * 60);

    if (minutes >= 1) {
        return minutes + 'm' +
            (seconds ? ' ' + seconds + 's' : '');
    } else {
        return seconds + 's';
    }
}
