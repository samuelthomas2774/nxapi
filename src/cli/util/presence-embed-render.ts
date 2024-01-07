import { FestVoteState } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from '../util.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { getPresenceFromUrl } from '../../api/znc-proxy.js';
import { PresenceResponse } from '../presence-server.js';
import { PresenceEmbedFormat, PresenceEmbedTheme, renderUserEmbedImage, renderUserEmbedSvg } from './presence-embed.js';

const debug = createDebug('cli:util:render-presence-embed');

export const command = 'render-presence-embed <url>';
export const desc = 'Render presence embed';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('url', {
        describe: 'Presence URL',
        type: 'string',
        demandOption: true,
    }).option('output', {
        describe: 'Output (svg, png, jpeg or webp)',
        type: 'string',
        default: 'svg',
    }).option('theme', {
        describe: 'Theme (light or dark)',
        type: 'string',
        default: 'light',
    }).option('friend-code', {
        describe: 'Friend code',
        type: 'string',
    }).option('show-splatoon3-fest-team', {
        describe: 'Show Splatoon 3 Splatfest team',
        type: 'boolean',
        default: false,
    }).option('scale', {
        describe: 'Image scale',
        type: 'number',
        default: 1,
    }).option('transparent', {
        describe: 'Remove border and use transparent background',
        type: 'boolean',
        default: false,
    }).option('width', {
        describe: 'Image width',
        type: 'number',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const theme = argv.theme === 'dark' ? PresenceEmbedTheme.DARK : PresenceEmbedTheme.LIGHT;
    const format =
        argv.output === 'png' ? PresenceEmbedFormat.PNG :
        argv.output === 'jpeg' ? PresenceEmbedFormat.JPEG :
        argv.output === 'webp' ? PresenceEmbedFormat.WEBP :
        PresenceEmbedFormat.SVG;

    if (argv.friendCode && !argv.friendCode.match(/^\d{4}-\d{4}-\d{4}$/)) {
        throw new TypeError('Invalid friend code');
    }

    const width = argv.width ? 
        argv.transparent ? argv.width + 60 : argv.width :
        500;

    const [presence, user, data] = await getPresenceFromUrl(argv.url);
    const result = data as PresenceResponse;

    const image_urls = [result.friend.imageUri];

    if ('imageUri' in result.friend.presence.game) image_urls.push(result.friend.presence.game.imageUri);
    if (argv.showSplatoon3FestTeam && result.splatoon3_fest_team?.myVoteState === FestVoteState.VOTED) image_urls.push(result.splatoon3_fest_team.image.url);

    const url_map: Record<string, readonly [name: string, data: Uint8Array, type: string]> = {};

    debug('images', image_urls);

    await Promise.all(image_urls.map(async (url) => {
        debug('Fetching image %s', url);
        const response = await fetch(url);
        const data = new Uint8Array(await response.arrayBuffer());

        url_map[url] = [url, data, 'image/jpeg'];
    }));

    const svg = renderUserEmbedSvg(result, url_map, theme, argv.friendCode, {
        show_splatoon3_fest_team: argv.showSplatoon3FestTeam,
    }, argv.scale, argv.transparent, width);
    const [image, type] = await renderUserEmbedImage(svg, format);

    console.warn('output type', type);
    process.stdout.write(image);
}
