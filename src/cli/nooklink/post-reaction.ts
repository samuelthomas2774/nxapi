import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nooklink.js';
import { ArgumentsCamelCase, Argv, initStorage, YargsArguments } from '../../util.js';
import { getUserToken } from './util.js';

const debug = createDebug('cli:nooklink:post-reaction');

export const command = 'post-reaction <reaction>';
export const desc = 'Send a reaction in an online Animal Crossing: New Horizons session';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('reaction', {
        describe: 'Reaction ID',
        type: 'string',
        demandOption: true,
    }).option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('islander', {
        describe: 'NookLink user ID',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nooklinkuser, data} = await getUserToken(storage, token, argv.islander, argv.zncProxyUrl, argv.autoUpdateSession);

    const emoticons = await nooklinkuser.getEmoticons();
    const reaction = emoticons.emoticons.find(r => r.label.toLowerCase() === argv.reaction.toLowerCase());

    if (!reaction) {
        throw new Error('Unknown reaction "' + argv.reaction + '"');
    }

    await nooklinkuser.reaction(reaction);
}
