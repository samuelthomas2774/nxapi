import createDebug from 'debug';
import fetch from 'node-fetch';
import type { Arguments as ParentArguments } from '../cli.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, YargsArguments } from '../util.js';

const debug = createDebug('cli:announcements');

export const command = 'webservicetoken <id>';
export const desc = 'Get a token for a web service';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('id', {
        describe: 'Web service ID',
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
        await storage.getItem('NintendoAccountToken.' + usernsid) ||
        await storage.getItem('SessionToken');
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const announcements = await nso.getAnnouncements();
    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();

    const webservice = webservices.result.find(w => '' + w.id === argv.id);

    if (!webservice) {
        throw new Error('Invalid web service');
    }

    const webserviceToken = await nso.getWebServiceToken(argv.id, data.credential.accessToken);

    // https://app.splatoon2.nintendo.net/?lang=en-GB&na_country=GB&na_lang=en-GB
    const url = new URL(webservice.uri);
    url.search = new URLSearchParams({
        lang: data.user.language,
        na_country: data.user.country,
        na_lang: data.user.language,
    }).toString();

    console.log('Web service', {
        name: webservice.name,
        url: url.toString(),
    }, webserviceToken.result);
}
