import type { Arguments as ParentArguments } from '../nso/index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import Users from '../../common/users.js';
import CoralApi, { ResponseEncryptionSymbol } from '../../api/coral.js';
import { NsaAssertionSymbol, ZncaApiNxapi } from '../../api/f.js';

const debug = createDebug('cli:nxapi-auth:link-url');

export const command = 'link-url';
export const desc = 'Link a Nintendo Switch user to nxapi-auth';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('znc-proxy-url', {
        describe: 'URL of Nintendo Switch Online app API proxy server to use',
        type: 'string',
        default: process.env.ZNC_PROXY_URL,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.zncProxyUrl) {
        throw new Error('API proxy not supported');
    }

    if (!process.env.NXAPI_ZNCA_API_AUTH_SCOPE) {
        // TODO: default cli/app clients should have this scope set automatically
        // - custom clients won't be able to request this scope though so can't
        // just be the default request scope
        process.env.NXAPI_ZNCA_API_AUTH_SCOPE = 'ca:gf ca:er ca:dr ca:na';
    }

    const storage = await initStorage(argv.dataPath);

    const user_na_id = argv.user ?? await storage.getItem('SelectedUser');
    const na_session_token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + user_na_id);

    const users = Users.coral(storage, argv.zncProxyUrl);
    const user = await users.get(na_session_token);

    if (!(user.nso instanceof CoralApi)) {
        throw new Error('API proxy not supported');
    }
    if (!(user.nso.request_encryption instanceof ZncaApiNxapi)) {
        throw new Error('Unsupported znca API');
    }

    const webservices = await user.getWebServices();

    const [fr_received, fr_sent] = await Promise.all([
        user.getReceivedFriendRequests(),
        user.getSentFriendRequests(),
    ]);

    const friendcodeurl = await user.nso.getFriendCodeUrl();

    const webservice = webservices.find(webservice => {
        const verifymembership = webservice.customAttributes.find(a => a.attrKey === 'verifyMembership');
        if (verifymembership?.attrValue === 'true' &&
            !user.data.nsoAccount.user.links.nintendoAccount.membership.active
        ) return false;

        return true;
    });

    if (!webservice) {
        throw new Error('Invalid web service');
    }
    
    debug('using web service', webservice);

    const webserviceToken = await user.nso.getWebServiceToken(webservice.id);

    const decrypt_result = webserviceToken[ResponseEncryptionSymbol]?.decrypt_result ?? {};
    const nsa_assertion = NsaAssertionSymbol in decrypt_result ? decrypt_result[NsaAssertionSymbol] as string : null;

    if (!nsa_assertion) {
        throw new Error('API did not return an NSA assertion');
    }

    debug('received NSA assertion', nsa_assertion);

    const link_url = new URL('https://nxapi-auth.fancy.org.uk/user/link');

    link_url.searchParams.append('nsa_assertion', nsa_assertion);
    link_url.searchParams.append('friend_code', friendcodeurl.friendCode);
    link_url.searchParams.append('friend_code_url', friendcodeurl.url);

    console.log('Open this URL and login to nxapi-auth to link your account:');
    console.log('');
    console.log(link_url);
    console.log('');
}
