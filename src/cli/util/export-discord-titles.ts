import { fetch } from 'undici';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { default_client, titles as unsorted_titles } from '../../discord/titles.js';
import { DiscordApplicationRpc, getDiscordApplicationRpc } from './discord-activity.js';
import { Title } from '../../discord/types.js';

const debug = createDebug('cli:util:export-discord-titles');

export const command = 'export-discord-titles';
export const desc = 'Export custom Discord configuration for all titles as JSON or CSV';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('format', {
        describe: 'Export format (json, json-pretty-print, csv)',
        type: 'string',
        default: 'json',
    }).option('exclude-discord-configuration', {
        describe: 'Only include title and client IDs - don\'t include Discord activity configuration',
        type: 'boolean',
        default: false,
    }).option('group-discord-clients', {
        describe: 'Group titles by Discord client (only for json, json-pretty-print formats)',
        type: 'boolean',
        default: false,
    }).option('include-title-contents', {
        describe: 'Include title contents from Nintendo eShop',
        type: 'boolean',
        default: false,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.format === 'json' || argv.format === 'json-pretty-print') {
        const data = argv.groupDiscordClients ?
            await getGroupedTitlesJson(argv.excludeDiscordConfiguration, argv.includeTitleContents) :
            await getTitlesJson(argv.excludeDiscordConfiguration, argv.includeTitleContents);

        if (argv.format === 'json-pretty-print') {
            console.log(JSON.stringify(data, null, 4));
        } else {
            console.log(JSON.stringify(data));
        }
    } else if (argv.format === 'csv') {
        if (argv.groupDiscordClients) throw new Error('--group-discord-clients is not compatible with --format csv');
        if (argv.includeTitleContents) throw new Error('--include-title-contents is not compatible with --format csv');

        const csv = getTitlesCsv(argv.excludeDiscordConfiguration);
        console.log(csv);
    } else {
        throw new Error('Unknown format');
    }
}

function getSortedTitles(exclude_discord_configuration = false): Title[] {
    const titles = [...unsorted_titles].sort((t1, t2) => t1.id > t2.id ? 1 : t2.id > t1.id ? -1 : 0);

    return exclude_discord_configuration ? titles.map(t => ({id: t.id, client: t.client})) : titles;
}

async function getTitlesWithContents(exclude_discord_configuration = false) {
    const titles = getSortedTitles(exclude_discord_configuration);
    const titles_with_contents = [];
    const titles_with_nsuids = [];
    const titles_to_fetch: {region: string; language: string; nsuids: string[];}[] = [];

    for (const title of titles) {
        const nsuid = await getTitleFirstNsuId(title.id);

        titles_with_nsuids.push({
            title,
            nsuid,
        });

        if (nsuid) {
            let c = titles_to_fetch.find(c => c.region === nsuid.region && c.language === nsuid.language);

            if (!c) {
                c = {region: nsuid.region, language: nsuid.language, nsuids: []};
                titles_to_fetch.push(c);
            }

            c.nsuids.push(nsuid.nsuid);
        }
    }

    const title_contents: Record<string, EcContent[]> = {};

    for (const t of titles_to_fetch) {
        const contents: EcContent[] = title_contents[t.region + '/' + t.language] = [];
        const batched_nsuids: string[][] = [];
        let current: string[] | null = null;

        for (const nsuid of t.nsuids) {
            if (!current) batched_nsuids.push(current = []);
            current.push(nsuid);

            if (current.length >= 20) {
                contents.push(...await getTitleContents(current, t.region, t.language));
                current = null;
            }
        }

        if (current?.length) {
            contents.push(...await getTitleContents(current, t.region, t.language));
            current = null;
        }
    }

    for (const title of titles_with_nsuids) {
        if (!title.nsuid) {
            titles_with_contents.push(title.title);
            continue;
        }

        const contents = (title_contents[title.nsuid.region + '/' + title.nsuid.language] ?? [])
            .find(t => '' + t.id === title.nsuid!.nsuid);

        if (contents && contents.content_type !== 'title') {
            debug('Title %s (NSU ID %s %s) is not an application', title.title.id,
                contents.id, contents.formal_name, contents.content_type);
        }

        titles_with_contents.push({
            ...title.title,
            nsuid: title.nsuid.nsuid,
            ec: contents ?? null,
        });
    }

    return titles_with_contents;
}

async function getTitlesJson(exclude_discord_configuration = false, include_title_contents = false) {
    const titles = include_title_contents ?
        await getTitlesWithContents(exclude_discord_configuration) :
        getSortedTitles(exclude_discord_configuration);

    return {titles};
}

async function getGroupedTitlesJson(exclude_discord_configuration = false, include_title_contents = false) {
    const titles = include_title_contents ?
        await getTitlesWithContents(exclude_discord_configuration) :
        getSortedTitles(exclude_discord_configuration);
    const clients: {
        id: string;
        application: DiscordApplicationRpc;
        titles: Title[];
    }[] = [];

    for (const title of titles) {
        let client = clients.find(c => c.id === (title.client ?? default_client));

        if (!client) {
            const application = await getDiscordApplicationRpc(title.client ?? default_client);

            client = {
                id: title.client ?? default_client,
                application,
                titles: [],
            };

            clients.push(client);
        }

        client.titles.push(title);
    }

    return {clients};
}

function getTitlesCsv(exclude_discord_configuration = false) {
    const titles = getSortedTitles(exclude_discord_configuration);

    const header = exclude_discord_configuration ?
        'titleid,discordclientid\n' :
        'titleid,discordclientid,titlenamesuffix,largeimagekey,largeimagetext,smallimagekey,smallimagetext\n';
    let csv = header;

    for (const title of titles) {
        csv += exclude_discord_configuration ?
            title.id + ',' +
            title.client + '\n' :

            title.id + ',' +
            title.client + ',' +
            (title.titleName ? JSON.stringify(title.titleName) : '') + ',' +
            (title.largeImageKey ? JSON.stringify(title.largeImageKey) : '') + ',' +
            (title.largeImageText ? JSON.stringify(title.largeImageText) : '') + ',' +
            (title.smallImageKey ? JSON.stringify(title.smallImageKey) : '') + ',' +
            (title.smallImageText ? JSON.stringify(title.smallImageText) : '') + '\n';
    }

    return csv;
}

async function getTitleNsuId(id: string, region = 'GB') {
    if (!id.match(/^0100([0-9a-f]{8})[02468ace]000$/i)) {
        throw new Error('Invalid title ID');
    }

    const url = 'https://ec.nintendo.com/apps/' + id.toLowerCase() + '/' + region;

    const response = await fetch(url, {
        redirect: 'manual',
    });
    debug('fetch %s %s, response %s', 'GET', url, response.status);

    if (response.status === 404) return null;

    if (response.status !== 303) {
        debug('Non-303 status code', await response.text());
        throw new Error('Unknown error');
    }

    await response.arrayBuffer();

    const location = response.headers.get('Location');

    if (!location) {
        throw new Error('Invalid response - didn\'t include Location header');
    }

    const redirect_url = new URL(location);
    let match;

    if (redirect_url.hostname === 'ec.nintendo.com' && (match =
        redirect_url.pathname.match(/^\/([A-Z]{2})\/([a-z]{2})\/(title|aoc)s?\/(\d{14})$/)
    )) {
        return {nsuid: match[4], region, language: match[2]};
    } else if (redirect_url.hostname === 'www.nintendo-europe.com' && redirect_url.pathname === '/redirect/') {
        return {nsuid: redirect_url.searchParams.get('nsuid')!, region,
            language: redirect_url.searchParams.get('language')!};
    } else if (redirect_url.hostname === 'www.nintendo.com' && (match =
        redirect_url.pathname.match(/^\/pos-redirect\/(\d{14})$/)
    )) {
        return {nsuid: match[1], region, language: default_language[region as 'US'] ?? 'en'};
    }

    debug('Unknown URL format received for title %s (%s)', id, region, location);

    throw new Error('Unknown URL format');
}

async function getTitleNsuIds(id: string, regions: string[] = ['GB']) {
    const nsuids: Record<string, {nsuid: string; region: string; language: string;} | null> = {};

    for (const region of regions) {
        nsuids[region] = await getTitleNsuId(id, region);
    }

    return nsuids;
}

async function getTitleFirstNsuId(id: string, regions: string[] = ['GB', 'JP', 'US', 'AU']) {
    for (const region of regions) {
        const nsuid = await getTitleNsuId(id, region);
        if (nsuid) return nsuid;
    }

    return null;
}

interface EcContentsResponse {
    contents: EcContent[];
}
interface EcContent {
    is_special_trial?: boolean;
    content_type: 'title' | 'demo' | 'aoc' | 'bundle';
    disclaimer?: string;
    dominant_colors: string;
    ex_membership_free: boolean;
    formal_name: string;
    hero_banner_url?: string;
    id: number;
    is_new?: boolean;
    membership_required?: boolean;
    public_status: 'public';
    rating_info: EcContentRating;
    release_date_on_eshop: string;
    screenshots: {
        images: {
            url: string;
        }[];
    }[];
    strong_disclaimer?: string;
    tags: unknown;
    target_titles: {
        id: number;
    }[];
}
interface EcContentRating {
    content_descriptors: {
        id: number;
        image_url: string;
        name: string;
        svg_image_url: string;
        type: 'descriptor';
    }[];
    rating: {
        age: number;
        id: number;
        image_url: string;
        name: string;
        provisional: boolean;
        svg_image_url: string;
    };
    rating_system: {
        id: number;
        name: string;
    };
}

const default_language = {
    'GB': 'en',
    'US': 'en',
    'AU': 'en',
    'JP': 'ja',
};

async function getTitleContents(id: string | string[], region = 'GB', language = default_language[region as 'GB']) {
    if (typeof id === 'string') id = [id];
    if (id.find(id => !id.match(/^\d{14}$/i))) {
        throw new Error('Invalid NSU ID');
    }
    if (!language?.match(/^[a-z]{2}$/)) {
        throw new Error('Invalid language');
    }

    const url = 'https://ec.nintendo.com/api/' + region + '/' + language + '/contents?id=' + id.join('&id=');

    const response = await fetch(url);
    debug('fetch %s %s, response %s', 'GET', url, response.status);

    if (response.status !== 200) {
        debug('Non-200 status code', await response.text());
        throw new Error('Unknown error');
    }

    const contents = await response.json() as EcContentsResponse;

    return contents.contents;
}
