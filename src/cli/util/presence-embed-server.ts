import * as os from 'node:os';
import * as net from 'node:net';
import express, { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import mimetypes from 'mime-types';
import { FestVoteState } from 'splatnet3-types/splatnet3';
import type { Arguments as ParentArguments } from './index.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { getPresenceFromUrl } from '../../api/znc-proxy.js';
import { PresenceResponse } from '../presence-server.js';
import { addCliFeatureUserAgent } from '../../util/useragent.js';
import { HttpServer, ResponseError } from '../../util/http-server.js';
import { git, product, version } from '../../util/product.js';
import { parseListenAddress } from '../../util/net.js';
import { RawValueSymbol, htmlentities } from '../../util/misc.js';
import { PresenceEmbedFormat, PresenceEmbedTheme, getUserEmbedOptionsFromRequest, renderUserEmbedImage, renderUserEmbedSvg } from '../../common/presence-embed.js';

const debug = createDebug('cli:util:presence-embed-server');

export const command = 'presence-embed-server <url>';
export const desc = 'Presence embed test server';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.positional('url', {
        describe: 'Presence URL',
        type: 'string',
        demandOption: true,
    }).option('listen', {
        describe: 'Server address and port',
        type: 'array',
        default: ['[::]:0'],
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    addCliFeatureUserAgent('presence-embed-test-server');

    const server = new Server(argv.url);
    const app = server.app;

    for (const address of argv.listen) {
        const [host, port] = parseListenAddress(address);
        const server = app.listen(port, host ?? '::');
        server.on('listening', () => {
            const address = server.address() as net.AddressInfo;
            console.log('Listening on %s, port %d', address.address, address.port);
        });
    }
}

class Server extends HttpServer {
    app: express.Express;

    constructor(
        readonly base_url: string,
    ) {
        super();

        const app = this.app = express();

        app.use('/api/presence', (req, res, next) => {
            console.log('[%s] %s %s HTTP/%s from %s, port %d%s, %s',
                new Date(), req.method, req.url, req.httpVersion,
                req.socket.remoteAddress, req.socket.remotePort,
                req.headers['x-forwarded-for'] ? ' (' + req.headers['x-forwarded-for'] + ')' : '',
                req.headers['user-agent']);

            res.setHeader('Server', product + ' presence-embed-test-server');
            res.setHeader('X-Server', product + ' presence-embed-test-server');
            res.setHeader('X-Served-By', os.hostname());

            next();
        });

        app.get('/api/presence/:user/embed', this.createApiRequestHandler((req, res) =>
            this.handlePresenceEmbedRequest(req, res, req.params.user, PresenceEmbedFormat.SVG)));
        app.get('/api/presence/:user/embed.png', this.createApiRequestHandler((req, res) =>
            this.handlePresenceEmbedRequest(req, res, req.params.user, PresenceEmbedFormat.PNG)));
        app.get('/api/presence/:user/embed.jpeg', this.createApiRequestHandler((req, res) =>
            this.handlePresenceEmbedRequest(req, res, req.params.user, PresenceEmbedFormat.JPEG)));
        app.get('/api/presence/:user/embed.webp', this.createApiRequestHandler((req, res) =>
            this.handlePresenceEmbedRequest(req, res, req.params.user, PresenceEmbedFormat.WEBP)));

        app.get('/api/presence/:user/embed.html', this.createApiRequestHandler((req, res) =>
            this.handlePresenceEmbedHtmlRequest(req, res, req.params.user)));
    }

    async handlePresenceEmbedRequest(req: Request, res: Response, presence_user_nsaid: string, format = PresenceEmbedFormat.SVG) {
        if (!presence_user_nsaid.match(/^[0-9a-f]{16}$/)) throw new ResponseError(404, 'not_found');

        res.setHeader('Access-Control-Allow-Origin', '*');

        const url = new URL(req.url, 'https://localhost');
        url.searchParams.delete('theme');
        url.searchParams.delete('friend-code');
        url.searchParams.delete('transparent');
        const qs = url.searchParams.size ? '?' + url.searchParams.toString() : '';

        const [presence, user, data] = await getPresenceFromUrl(this.base_url + '/' + presence_user_nsaid + qs);
        const result = data as PresenceResponse;

        const {theme, friend_code, transparent, width, scale: req_scale, options} = getUserEmbedOptionsFromRequest(req);
        const scale = format === PresenceEmbedFormat.SVG ? 1 : req_scale;

        const etag = createHash('sha256').update(JSON.stringify({
            data,
            format,
            theme,
            friend_code,
            transparent,
            width,
            scale,
            options,
            v: version + '-' + git?.revision,
        })).digest('base64url');

        if (req.headers['if-none-match'] === '"' + etag + '"' || req.headers['if-none-match'] === 'W/"' + etag + '"') {
            res.statusCode = 304;
            res.end();
            return;
        }

        const image_urls = [result.friend.imageUri];

        if ('imageUri' in result.friend.presence.game) image_urls.push(result.friend.presence.game.imageUri);
        for (const stage of result.splatoon3_vs_setting?.vsStages ?? []) image_urls.push(stage.image.url);
        if (result.splatoon3_coop_setting) image_urls.push(result.splatoon3_coop_setting.coopStage.thumbnailImage.url);
        for (const weapon of result.splatoon3_coop_setting?.weapons ?? []) image_urls.push(weapon.image.url);
        if (options.show_splatoon3_fest_team && result.splatoon3_fest_team?.myVoteState === FestVoteState.VOTED) image_urls.push(result.splatoon3_fest_team.image.url);

        const url_map: Record<string, readonly [name: string, data: Uint8Array, type: string]> = {};

        await Promise.all(image_urls.map(async (url) => {
            debug('Fetching image %s', url);
            const response = await fetch(url);
            const data = new Uint8Array(await response.arrayBuffer());

            const type = (mimetypes.contentType(response.headers.get('Content-Type') ?? 'application/octet-stream')
                || 'application/octet-stream').split(';')[0];

            url_map[url] = [url, data, type];
        }));

        const svg = renderUserEmbedSvg(result, url_map, theme, friend_code, options, scale, transparent, width);
        const [image, type] = await renderUserEmbedImage(svg, format);

        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'public, no-cache'); // no-cache means store but revalidate
        res.setHeader('Etag', '"' + etag + '"');
        res.end(image);
    }

    async handlePresenceEmbedHtmlRequest(req: Request, res: Response, presence_user_nsaid: string) {
        if (!presence_user_nsaid.match(/^[0-9a-f]{16}$/)) throw new ResponseError(404, 'not_found');

        const url = new URL(req.url, 'https://localhost');
        url.searchParams.delete('theme');
        const qs = url.searchParams.size ? '&' + url.searchParams.toString() : '';

        const url_2 = new URL(req.url, 'https://localhost');
        url_2.searchParams.delete('theme');
        url_2.searchParams.delete('friend-code');
        const qs_2 = url_2.searchParams.size ? '?' + url_2.searchParams.toString() : '';

        const [presence, user, data] = await getPresenceFromUrl(this.base_url + '/' + presence_user_nsaid + qs_2);
        const result = data as PresenceResponse;

        const image_urls = [result.friend.imageUri];

        if ('imageUri' in result.friend.presence.game) image_urls.push(result.friend.presence.game.imageUri);
        if (result.splatoon3_fest_team?.myVoteState === FestVoteState.VOTED) image_urls.push(result.splatoon3_fest_team.image.url);

        const url_map: Record<string, readonly [name: string, data: Uint8Array, type: string]> = {};

        await Promise.all(image_urls.map(async (url) => {
            debug('Fetching image %s', url);
            const response = await fetch(url);
            const data = new Uint8Array(await response.arrayBuffer());

            url_map[url] = [url, data, 'image/jpeg'];
        }));

        const svg = renderUserEmbedSvg(result, url_map, PresenceEmbedTheme.LIGHT, undefined, {
            show_splatoon3_fest_team: true,
        }, 2, true, 800);

        res.setHeader('Content-Type', 'text/html');
        res.write(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;min-height:100vh;width:100vw;min-width:fit-content;display:flex;align-items:center;justify-content:center}</style></head>`);
        res.write(htmlentities`<body><picture><source srcset="embed?theme=dark${qs}" media="(prefers-color-scheme:dark)"/><img src="embed?theme=light${qs}" alt="Nintendo Switch presence"/></picture><p>${{[RawValueSymbol]: svg}}</p></body></html>\n`);
        res.end();
    }
}
