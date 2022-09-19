import createDebug from 'debug';
import Table from '../util/table.js';
import type { Arguments as ParentArguments } from '../splatnet3.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getBulletToken } from '../../common/auth/splatnet3.js';

const debug = createDebug('cli:splatnet3:festival');

export const command = 'festival <id>';
export const desc = 'Show details about a specific Splatfest in your region';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('id', {
        describe: 'Splatfest ID',
        type: 'string',
        demandOption: true,
    }).option('user', {
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
    const {splatnet, data} = await getBulletToken(storage, token, argv.zncProxyUrl, argv.autoUpdateSession);

    const fest_records = await splatnet.getFestRecords();

    const req_id = argv.id;
    const encoded_req_id = Buffer.from(req_id).toString('base64');
    const encoded_part_req_id = Buffer.from('Fest-' + req_id).toString('base64');
    const fest = fest_records.data.festRecords.nodes.find(f => f.id === req_id ||
        f.id === encoded_req_id || f.id === encoded_part_req_id);

    if (!fest) {
        throw new Error('Invalid Splatfest ID');
    }

    const detail = await splatnet.getFestDetail(fest.id);
    const votes = await splatnet.getFestVotingStatus(fest.id);

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify({fest: detail.data.fest, votes: votes.data.fest}, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify({fest: detail.data.fest, votes: votes.data.fest}));
        return;
    }

    console.log('Details', detail.data.fest);

    const table = new Table({
        head: [
            'Name',
            'State',
            'Team',
        ],
    });

    for (const team of votes.data.fest.teams) {
        for (const vote of team.votes.nodes) {
            table.push([vote.playerName, 'Voted', team.teamName]);
        }
        for (const vote of team.preVotes.nodes) {
            table.push([vote.playerName, 'Planning to vote', team.teamName]);
        }
    }

    for (const vote of votes.data.fest.undecidedVotes.nodes) {
        table.push([vote.playerName, 'Undecided', '-']);
    }

    console.log('Friends votes');
    console.log(table.toString());
}
