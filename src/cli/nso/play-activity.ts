import Table from '../../util/table.js';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';
import { getTitleIdFromEcUrl, hrduration } from '../../util/misc.js';

const debug = createDebug('cli:nso:play-activity');

export const command = 'play-activity';
export const desc = 'Show your play activity';

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
    }).option('friend-nsaid', {
        describe: 'Friend NSA ID',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const [friends, [chats, webservices, activeevent, media, announcements, current_user]] = await Promise.all([
        nso.getFriendList(),

        data[Login] || true ? Promise.all([
            nso.getChats(),
            nso.getWebServices(),
            nso.getActiveEvent(),
            nso.getMedia(),
            nso.getAnnouncements(),
            nso.getCurrentUser(),
        ]) : [],
    ]);

    const friend = argv.friendNsaid ? friends.friends.find(f => f.nsaId === argv.friendNsaid) : null;

    if (argv.friendNsaid && !friend) {
        throw new Error('Unknown friend ' + argv.friendNsaid);
    }

    const [play_log, [current_user_2, permissions]] = await Promise.all([
        nso.getPlayLog(friend?.nsaId ?? data.nsoAccount.user.nsaId),

        !friend ? Promise.all([
            nso.getCurrentUser(),
            nso.getCurrentUserPermissions(),
        ]) : [],
    ]);

    const table = new Table({
        head: [
            'Title ID',
            'Name',
            'First played at',
            'Total play time',
        ],
    });

    for (const game of play_log) {
        const title_id = getTitleIdFromEcUrl(game.shopUri);

        table.push([
            title_id ?? '',
            game.name,
            new Date(game.firstPlayedAt * 1000).toISOString(),
            hrduration(game.totalPlayTime),
        ]);
    }

    console.log(table.toString());
}
