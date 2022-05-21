import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getUserToken, getWebServiceToken } from '../../common/auth/nooklink.js';

const debug = createDebug('cli:nooklink:island');

export const command = 'island';
export const desc = 'Get the player\'s passport data (island information)';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
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
    const {nooklink, data: wstoken} = await getWebServiceToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl);

    const users = await nooklink.getUsers();
    const user = users.users.find(u => u.id === nooklinkuser.user_id)!;

    const island = await nooklinkuser.getIslandProfile(user.land.id);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify(island, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify(island));
        return;
    }

    console.log('Island', {
        ...island,
        mNormalNpc: undefined,
        mVillager: undefined,
    });

    const table = new Table({
        head: [
            'Type',
            'Name',
            'Birthday',
            'NookLink user ID',
        ],
    });

    for (const villager of [...island.mVillager, ...island.mNormalNpc]) {
        table.push([
            'mPNm' in villager ? villager.mIsLandMaster ? 'Resident Representative' : 'Player' : 'NPC',
            'mPNm' in villager ? villager.mPNm : villager.name,
            'mPNm' in villager ?
                villager.mBirthDay + '/' + villager.mBirthMonth :
                villager.birthDay + '/' + villager.birthMonth,
            'mPNm' in villager ? villager.userId ?? '' : '',
        ]);
    }

    console.log('Residents');
    console.log(table.toString());
}
