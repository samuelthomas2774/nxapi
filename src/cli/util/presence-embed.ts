import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Request } from 'express';
import sharp from 'sharp';
import { CoopRule, FestVoteState, FriendOnlineState, StageScheduleResult } from 'splatnet3-types/splatnet3';
import { dir } from '../../util/product.js';
import createDebug from '../../util/debug.js';
import { Game, PresenceState } from '../../api/coral-types.js';
import { RawValueSymbol, htmlentities } from '../../util/misc.js';
import { PresenceResponse } from '../presence-server.js';

const debug = createDebug('cli:util:presence-embed');

type VsSchedule_event = StageScheduleResult['eventSchedules']['nodes'][0];
type LeagueMatchSetting_schedule = VsSchedule_event['leagueMatchSetting'];

export enum PresenceEmbedFormat {
    SVG,
    PNG,
    JPEG,
    WEBP,
}

export enum PresenceEmbedTheme {
    LIGHT,
    DARK,
}
interface PresenceEmbedThemeColours {
    background: string;
    separator: string;
    text: string;
    online: string;
    online_border: string;
}

const embed_themes: Record<PresenceEmbedTheme, PresenceEmbedThemeColours> = {
    [PresenceEmbedTheme.LIGHT]: {
        background: '#ebebeb',
        separator: '#7b7b7b',
        text: '#000000',
        online: '#2db742',
        online_border: '#0eb728',
    },
    [PresenceEmbedTheme.DARK]: {
        background: '#2d2d2d',
        separator: '#7e7e7e',
        text: '#ffffff',
        online: '#47e85f',
        online_border: '#19e838',
    },
};

interface UserEmbedOptions {
    show_splatoon3_fest_team?: boolean;
}

const embed_titles: Partial<Record<string, (
    result: PresenceResponse,
    url_map: Record<string, string | readonly [url: string, data: Uint8Array, type: string]>,
    image: (url: string) => string | undefined,
    theme?: PresenceEmbedTheme,
    options?: UserEmbedOptions,
) => readonly [svg: string, height: number, override_description: string | null]>> = {
    '0100c2500fc20000': renderUserSplatoon3EmbedPartialSvg,
};

export function getUserEmbedOptionsFromRequest(req: Request) {
    const url = new URL(req.url, 'https://localhost');

    const theme = url.searchParams.get('theme') === 'dark' ? PresenceEmbedTheme.DARK : PresenceEmbedTheme.LIGHT;
    const friend_code = url.searchParams.getAll('friend-code').find(c => c.match(/^\d{4}-\d{4}-\d{4}$/));
    const transparent = url.searchParams.get('transparent') === '1';

    let width = url.searchParams.getAll('width')
        .map(w => parseInt(w))
        .map(w => transparent ? w + 60 : w)
        .find(w => !isNaN(w) && w >= 500);

    if (!width) width = 500;
    if (width > 1500) width = 1500;

    let scale = url.searchParams.getAll('scale')
        .map(s => parseInt(s))
        .find(s => !isNaN(s) && s >= 1 && s <= 4);

    const options: UserEmbedOptions = {
        show_splatoon3_fest_team: url.searchParams.get('show-splatoon3-fest-team') === '1',
    };

    return {theme, friend_code, transparent, width, scale, options};
}

export async function renderUserEmbedImage(
    svg: string,
    format: PresenceEmbedFormat,
): Promise<[data: Buffer, type: string]> {
    if (format === PresenceEmbedFormat.SVG) {
        return [Buffer.from(svg), 'image/svg+xml'];
    }

    const start = Date.now();
    debug('generating image, format %s', PresenceEmbedFormat[format]);

    let image = sharp(Buffer.from(svg)).withMetadata({
        density: 72 * 2,
    });

    if (format === PresenceEmbedFormat.PNG) image = image.png();
    if (format === PresenceEmbedFormat.JPEG) image = image.jpeg();
    if (format === PresenceEmbedFormat.WEBP) image = image.webp();

    const data = await image.toBuffer();

    debug('generated %s in %d ms', PresenceEmbedFormat[format], Date.now() - start);

    if (format === PresenceEmbedFormat.PNG) return [data, 'image/png'];
    if (format === PresenceEmbedFormat.JPEG) return [data, 'image/jpeg'];
    if (format === PresenceEmbedFormat.WEBP) return [data, 'image/webp'];

    throw new TypeError('Invalid format');
}

export function renderUserEmbedSvg(
    result: PresenceResponse,
    url_map: Record<string, string | readonly [url: string, data: Uint8Array, type: string]>,
    theme = PresenceEmbedTheme.LIGHT,
    friend_code?: string,
    options?: UserEmbedOptions,
    scale = 1,
    transparent = false,
    width = 500,
) {
    if (width < 500) width = 500;
    let height = 180;
    if (friend_code) height += 40;

    const colours = embed_themes[theme];
    const font_family = '\'Open Sans\', -apple-system, BlinkMacSystemFont, Arial, sans-serif';

    const state = result.friend.presence.state;
    const game = 'name' in result.friend.presence.game ? result.friend.presence.game : null;

    const image = (url: string) =>
        url_map[url] instanceof Array ?
            'data:' + url_map[url][2] + ';base64,' +
            Buffer.from(url_map[url][1]).toString('base64') :
        url_map[url] as string | undefined;

    const title_extra = result.title ? embed_titles[result.title.id]?.call(null, result, url_map, image, theme, options) : null;
    if (title_extra) height += title_extra[1];

    return htmlentities`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- ${JSON.stringify(result, null, 4)} -->
<svg
    width="${(width + (transparent ? -60 : 0)) * scale}"
    height="${(height + (transparent ? -60 : 0) + (title_extra?.[1] ?? 0)) * scale}"
    viewBox="${transparent ? '30 30' : '0 0'} ${width + (transparent ? -60 : 0)} ${height + (transparent ? -60 : 0) + (title_extra?.[1] ?? 0)}"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
>
    <style>${embed_style}</style>

    <defs>
        <linearGradient id="gradient-out">
            <stop offset="0%" stop-opacity="1" stop-color="#ffffff"></stop>
            <stop offset="100%" stop-opacity="0" stop-color="#ffffff"></stop>
        </linearGradient>

        <mask id="mask-out">
            <rect x="0" y="0" width="${width - 50}" height="${height}" fill="#ffffff"></rect>
            <rect x="${width - 50}" y="0" width="20" height="${height}" fill="url(#gradient-out)"></rect>
        </mask>
    </defs>

    ${{[RawValueSymbol]: transparent ? '' : htmlentities`
        <rect x="0" y="0" width="${width}" height="${height}" fill="${colours.background}" />
    `}}

    <image x="30" y="30" width="120" height="120"
        href="${image(result.friend.imageUri) ?? result.friend.imageUri}" />
    <text x="180" y="57" fill="${colours.text}" font-size="26" font-family="${font_family}" font-weight="500" mask="url(#mask-out)">${result.friend.name}</text>

    <line x1="180" y1="73" x2="${width - 30}" y2="73" stroke="${colours.separator}" />

    ${{[RawValueSymbol]: game && (state === PresenceState.ONLINE || state === PresenceState.PLAYING) ? htmlentities`
        <image x="180" y="87" width="60" height="60"
            href="${image(game.imageUri) ?? game.imageUri}" />

        ${{[RawValueSymbol]: renderUserTitleEmbedPartialSvg(game, title_extra?.[2], colours, font_family)}}
    ` : htmlentities`
        <text x="180" y="97" fill="${colours.text}" font-size="14" font-family="${font_family}" font-weight="400">Offline</text>
    `}}

    ${{[RawValueSymbol]: friend_code ? htmlentities`
        <text x="30" y="186" fill="${colours.text}" font-size="14" font-family="${font_family}" font-weight="400">Friend code: SW-${friend_code}</text>
    ` : ''}}

    ${{[RawValueSymbol]: options?.show_splatoon3_fest_team && result.splatoon3_fest_team?.myVoteState === FestVoteState.VOTED ? htmlentities`
        <image x="${width - 60}" y="33" width="30" height="30"
            href="${image(result.splatoon3_fest_team.image.url) ?? result.splatoon3_fest_team.image.url}" />
    ` : ''}}

    ${{[RawValueSymbol]: title_extra?.[0] ?? ''}}
</svg>
`;
}

function renderUserTitleEmbedPartialSvg(
    game: Game, description: string | null | undefined,
    colours: PresenceEmbedThemeColours, font_family: string,
) {
    if (typeof description !== 'string') description = game.sysDescription;

    const playing_text_offset = description ? 92 : 97;
    const title_name_text_offset = description ? 122 : 133;

    return htmlentities`
        <rect x="255" y="${playing_text_offset}" width="10" height="10" fill="${colours.online}"
            stroke="${colours.online_border}" stroke-width="1" rx="1" ry="1" stroke-linejoin="round"
        />
        <text x="272" y="${playing_text_offset + 10}" fill="${colours.online}" font-size="14" font-family="${font_family}" font-weight="400" mask="url(#mask-out)">Online</text>

        <text x="255" y="${title_name_text_offset}" fill="${colours.text}" font-size="14" font-family="${font_family}" font-weight="400" mask="url(#mask-out)">${game.name}</text>
    ` + (description ? htmlentities`
        <text x="255" y="142" fill="${colours.text}" font-size="14" font-family="${font_family}" font-weight="300" mask="url(#mask-out)">${description ?? ''}</text>
    ` : '');
}

function renderUserSplatoon3EmbedPartialSvg(
    result: PresenceResponse,
    url_map: Record<string, string | readonly [url: string, data: Uint8Array, type: string]>,
    image: (url: string) => string | undefined,
    theme = PresenceEmbedTheme.LIGHT,
    options?: UserEmbedOptions,
) {
    if (result.splatoon3?.vsMode && (
        result.splatoon3.onlineState === FriendOnlineState.VS_MODE_FIGHTING ||
        result.splatoon3.onlineState === FriendOnlineState.VS_MODE_MATCHING
    )) {
        const mode_name =
            result.splatoon3.vsMode.mode === 'REGULAR' ? 'Regular Battle' :
            result.splatoon3.vsMode.id === 'VnNNb2RlLTI=' ? 'Anarchy Battle (Series)' : // VsMode-2
            result.splatoon3.vsMode.id === 'VnNNb2RlLTUx' ? 'Anarchy Battle (Open)' : // VsMode-51
            result.splatoon3.vsMode.mode === 'BANKARA' ? 'Anarchy Battle' :
            result.splatoon3.vsMode.id === 'VnNNb2RlLTY=' ? 'Splatfest Battle (Open)' : // VsMode-6
            result.splatoon3.vsMode.id === 'VnNNb2RlLTc=' ? 'Splatfest Battle (Pro)' : // VsMode-7
            result.splatoon3.vsMode.id === 'VnNNb2RlLTg=' ? 'Tricolour Battle' : // VsMode-8
            result.splatoon3.vsMode.mode === 'FEST' ? 'Splatfest Battle' :
            result.splatoon3.vsMode.id === 'VnNNb2RlLTQ=' ? 'Challenge' : // VsMode-4
            result.splatoon3.vsMode.mode === 'LEAGUE' ? 'Challenge' :
            result.splatoon3.vsMode.mode === 'X_MATCH' ? 'X Battle' : // VsMode-3
            undefined;

        const setting = result.splatoon3_vs_setting;
        const fest_team = result.splatoon3_fest_team;

        const description =
            (mode_name ?? result.splatoon3.vsMode.name) +
            (result.splatoon3.vsMode.mode === 'FEST' && fest_team ?
                ' - Team ' + fest_team.teamName : '') +
            (result.splatoon3.vsMode.mode === 'LEAGUE' && setting && 'leagueMatchEvent' in setting ?
                ': ' + (setting as LeagueMatchSetting_schedule).leagueMatchEvent.name : '') +
            (result.splatoon3.vsMode.mode !== 'FEST' && result.splatoon3.vsMode.mode !== 'LEAGUE' && setting ?
                ' - ' + setting.vsRule.name : '') +
            (result.splatoon3.onlineState === FriendOnlineState.VS_MODE_MATCHING ? ' (matching)' : '');

        return ['', 0, description] as const;
    }

    if (result.splatoon3?.onlineState === FriendOnlineState.COOP_MODE_FIGHTING ||
        result.splatoon3?.onlineState === FriendOnlineState.COOP_MODE_MATCHING
    ) {
        const rule_name =
            result.splatoon3.coopRule === CoopRule.REGULAR ? 'Salmon Run' :
            result.splatoon3.coopRule === CoopRule.BIG_RUN ? 'Big Run' :
            result.splatoon3.coopRule === CoopRule.TEAM_CONTEST ? 'Eggstra Work' : null;

        const description = (rule_name ?? 'Salmon Run') +
            (result.splatoon3.onlineState === FriendOnlineState.COOP_MODE_MATCHING ? ' (matching)' : '');

        return ['', 0, description] as const;
    }

    if (result.splatoon3?.onlineState === FriendOnlineState.MINI_GAME_PLAYING) {
        const description = 'Tableturf Battle';
        return ['', 0, description] as const;
    }

    return ['', 0, null] as const;
}

const embed_fonts: [name: string, style: string, weight: string, files: [format: string, type: string, path: string][]][] = [
    ['Open Sans', 'normal', '400', [['opentype', 'font/ttf', 'opensans-normal-400.ttf']]],
    ['Open Sans', 'normal', '500', [['opentype', 'font/ttf', 'opensans-normal-500.ttf']]],
];

const embed_style = `
text {
    -webkit-user-select: none;
    user-select: none;
}

` + (await Promise.all(embed_fonts.map(async ([name, style, weight, files]) => `@font-face {
    font-family: '${name}';
    font-style: ${style};
    font-weight: ${weight};
    src: ${(await Promise.all(files.map(async ([format, type, file]) => `url('data:${type};base64,${
        (await fs.readFile(path.join(dir, 'resources', 'cli', 'fonts', file))).toString('base64')
    }') format('${format}')`))).join(',')};
}`))).join('\n');
