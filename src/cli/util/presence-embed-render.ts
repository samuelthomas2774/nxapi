import mimetypes from 'mime-types';
import { FestVoteState } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { getPresenceFromUrl } from '../../api/znc-proxy.js';
import { PresenceResponse } from '../presence-server.js';
import { PresenceEmbedFormat, PresenceEmbedTheme, renderUserEmbedImage, renderUserEmbedSvg } from '../../common/presence-embed.js';

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

    const image_urls = [result.friend.image2Uri];

    if ('imageUri' in result.friend.presence.game) image_urls.push(result.friend.presence.game.imageUri);
    for (const stage of result.splatoon3_vs_setting?.vsStages ?? []) image_urls.push(stage.image.url);
    if (result.splatoon3_coop_setting) image_urls.push(result.splatoon3_coop_setting.coopStage.thumbnailImage.url);
    for (const weapon of result.splatoon3_coop_setting?.weapons ?? []) image_urls.push(weapon.image.url);
    if (argv.showSplatoon3FestTeam && result.splatoon3_fest_team?.myVoteState === FestVoteState.VOTED) image_urls.push(result.splatoon3_fest_team.image.url);

    const url_map: Record<string, readonly [name: string, data: Uint8Array, type: string]> = {};

    debug('images', image_urls);

    await Promise.all(image_urls.map(async (url) => {
        debug('Fetching image %s', url);
        const response = await fetch(url);
        const data = new Uint8Array(await response.arrayBuffer());

        const type = (mimetypes.contentType(response.headers.get('Content-Type') ?? 'application/octet-stream')
            || 'application/octet-stream').split(';')[0];

        url_map[url] = [url, data, type];
    }));

    const svg = renderUserEmbedSvg(result, url_map, theme, argv.friendCode, {
        show_splatoon3_fest_team: argv.showSplatoon3FestTeam,
    }, argv.scale, argv.transparent, width);
    const [image, type] = await renderUserEmbedImage(svg, format);

    console.warn('output type', type);
    process.stdout.write(image);
}
