import createDebug from 'debug';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken, Login } from '../../common/auth/coral.js';

const debug = createDebug('cli:nso:webservicetoken');

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
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    if (data[Login]) {
        const announcements = await nso.getAnnouncements();
    }

    const friends = await nso.getFriendList();
    const webservices = await nso.getWebServices();
    const activeevent = await nso.getActiveEvent();

    const webservice = webservices.find(w => '' + w.id === argv.id);

    if (!webservice) {
        throw new Error('Invalid web service');
    }

    const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');

    if (verifymembership?.attrValue === 'true') {
        const membership = data.nsoAccount.user.links.nintendoAccount.membership;
        const active = typeof membership.active === 'object' ? membership.active.active : membership.active;
        if (!active) throw new Error('Nintendo Switch Online membership required');
    }

    const webserviceToken = await nso.getWebServiceToken(argv.id);

    // https://app.splatoon2.nintendo.net/?lang=en-GB&na_country=GB&na_lang=en-GB
    const url = new URL(webservice.uri);
    url.search = new URLSearchParams({
        lang: data.user.language,
        na_country: data.user.country,
        na_lang: data.user.language,
    }).toString();

    if (argv.jsonPrettyPrint) {
        console.log(JSON.stringify({
            webservice,
            token: webserviceToken,
        }, null, 4));
        return;
    }
    if (argv.json) {
        console.log(JSON.stringify({
            webservice,
            token: webserviceToken,
        }));
        return;
    }

    console.log('Web service', {
        name: webservice.name,
        url: url.toString(),
    }, webserviceToken);
}
