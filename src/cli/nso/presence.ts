import createDebug from 'debug';
import persist from 'node-persist';
import DiscordRPC from 'discord-rpc';
import fetch from 'node-fetch';
import { ActiveEvent, CurrentUser, Friend, Presence, PresenceState, ZncErrorResponse } from '../../api/znc-types.js';
import ZncApi from '../../api/znc.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, getToken, initStorage, LoopResult, SavedToken, YargsArguments } from '../../util.js';
import { DiscordPresenceContext, getDiscordPresence, getInactiveDiscordPresence } from '../../discord/util.js';
import { handleEnableSplatNet2Monitoring, ZncNotifications } from './notify.js';
import { ErrorResponse } from '../../index.js';
import { getPresenceFromUrl } from '../../api/znc-proxy.js';

const debug = createDebug('cli:nso:presence');
const debugProxy = createDebug('cli:nso:presence:proxy');
const debugDiscord = createDebug('cli:nso:presence:discordrpc');

export const command = 'presence';
export const desc = 'Start Discord Rich Presence';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('show-inactive-presence', {
        describe: 'Show Discord presence if your console is online but you are not playing (only enable if you are the only user on all consoles your account exists on)',
        type: 'boolean',
        default: false,
    }).option('show-event', {
        describe: 'Show event (Online Lounge/voice chat) details - this shows the number of players in game (experimental)',
        type: 'boolean',
        default: false,
    }).option('friend-nsaid', {
        alias: ['friend-naid'],
        describe: 'Friend\'s Nintendo Switch account ID',
        type: 'string',
    }).option('friend-code', {
        describe: 'Friend code',
        type: 'string',
    }).option('user-notifications', {
        describe: 'Show notification for your own user',
        type: 'boolean',
        default: false,
    }).option('friend-notifications', {
        describe: 'Show notification for friends',
        type: 'boolean',
        default: false,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        default: 30,
    }).option('presence-url', {
        describe: 'URL to get user presence from, for use with `nxapi nso http-server`',
        type: 'string',
    }).option('discord-preconnect', {
        describe: 'Stay connected to Discord while not playing',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor', {
        describe: 'Download new SplatNet 2 data when you are playing Splatoon 2 online',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-directory', {
        alias: ['sn2-path'],
        describe: 'Directory to write SplatNet 2 record data to',
        type: 'string',
    }).option('splatnet2-monitor-profile-image', {
        alias: ['sn2-profile-image'],
        describe: 'Include profile image',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-favourite-stage', {
        alias: ['sn2-favourite-stage'],
        describe: 'Favourite stage to include on profile image',
        type: 'string',
    }).option('splatnet2-monitor-favourite-colour', {
        alias: ['sn2-favourite-colour'],
        describe: 'Favourite colour to include on profile image',
        type: 'string',
    }).option('splatnet2-monitor-battles', {
        alias: ['sn2-battles'],
        describe: 'Include regular/ranked/private/festival battle results',
        type: 'boolean',
        default: true,
    }).option('splatnet2-monitor-battle-summary-image', {
        alias: ['sn2-battle-summary-image'],
        describe: 'Include regular/ranked/private/festival battle summary image',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-battle-images', {
        alias: ['sn2-battle-images'],
        describe: 'Include regular/ranked/private/festival battle result images',
        type: 'boolean',
        default: false,
    }).option('splatnet2-monitor-coop', {
        alias: ['sn2-coop'],
        describe: 'Include coop (Salmon Run) results',
        type: 'boolean',
        default: true,
    }).option('splatnet2-monitor-update-interval', {
        alias: ['sn2-update-interval'],
        describe: 'Update interval in seconds',
        type: 'number',
        // 3 minutes - the monitor is only active while the authenticated user is playing Splatoon 2 online
        default: 3 * 60,
    }).option('splatnet2-auto-update-session', {
        alias: ['sn2-auto-update-session'],
        describe: 'Automatically obtain and refresh the iksm_session cookie',
        type: 'boolean',
        default: true,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presenceUrl) {
        if (argv.showEvent) throw new Error('--presence-url not compatible with --show-event');
        if (argv.friendNsaid) throw new Error('--presence-url not compatible with --friend-nsaid');
        if (argv.userNotifications) throw new Error('--presence-url not compatible with --user-notifications');
        if (argv.friendNotifications) throw new Error('--presence-url not compatible with --friend-notifications');

        const i = new ZncProxyDiscordPresence(argv, argv.presenceUrl);

        if (argv.splatnet2Monitor) {
            const storage = await initStorage(argv.dataPath);

            const usernsid = argv.user ?? await storage.getItem('SelectedUser');
            const token: string = argv.token ||
                await storage.getItem('NintendoAccountToken.' + usernsid);
            const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

            console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
                data.user.screenName, data.user.nickname, data.nsoAccount.user.name);
            console.warn('SplatNet 2 monitoring is enabled for %s (NA %s, NSO %s), but using znc proxy for ' +
                'presence. The presence URL must return the presence of the authenticated user for SplatNet 2 ' +
                'monitoring to work.',
                data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

            i.splatnet2_monitors.set(argv.presenceUrl, handleEnableSplatNet2Monitoring(argv, storage, token));
        } else {
            if (argv.user) throw new Error('--presence-url not compatible with --user');
            if (argv.token) throw new Error('--presence-url not compatible with --token');

            console.warn('Not authenticated; using znc proxy');
        }

        await i.loop(true);

        while (true) {
            await i.loop();
        }

        return;
    }

    if (argv.showEvent && argv.friendNsaid) throw new Error('--show-event not compatible with --friend-nsaid');

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const i = new ZncDiscordPresence(argv, storage, token, nso, data);

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    if (argv.splatnet2Monitor) {
        if (argv.friendNsaid) {
            console.warn('SplatNet 2 monitoring is enabled, but --friend-nsaid is set. SplatNet 2 records will only be downloaded when the authenticated user is playing Splatoon 2 online, regardless of the --friend-nsaid user.');
        }

        i.splatnet2_monitors.set(data.nsoAccount.user.nsaId, handleEnableSplatNet2Monitoring(argv, storage, token));
    }

    await i.loop(true);

    while (true) {
        await i.loop();
    }
}

export class ZncDiscordPresence extends ZncNotifications {
    presence_user: string | null;
    discord_preconnect = false;
    show_friend_code = false;
    force_friend_code: CurrentUser['links']['friendCode'] | undefined = undefined;
    show_console_online = false;
    show_active_event = true;

    constructor(
        argv: Pick<ArgumentsCamelCase<Arguments>,
            'userNotifications' | 'friendNotifications' | 'updateInterval' |
            'friendCode' | 'showInactivePresence' | 'showEvent' | 'friendNsaid' |
            'discordPreconnect'
        >,
        storage: persist.LocalStorage,
        token: string,
        nso: ZncApi,
        data: Omit<SavedToken, 'expires_at'>,
    ) {
        super(argv, storage, token, nso, data);

        let match;
        this.force_friend_code =
            (match = (argv.friendCode as string)?.match(/^(SW-)?(\d{4})-?(\d{4})-?(\d{4})$/)) ?
                {id: match[2] + '-' + match[3] + '-' + match[4], regenerable: false, regenerableAt: 0} : undefined;
        this.show_friend_code = !!this.force_friend_code || argv.friendCode === '' || argv.friendCode === '-';
        this.show_console_online = argv.showInactivePresence;
        this.show_active_event = argv.showEvent;

        this.presence_user = argv.friendNsaid ?? data?.nsoAccount.user.nsaId;
        this.discord_preconnect = argv.discordPreconnect;
    }

    async init() {
        const {friends, user, activeevent} = await this.fetch([
            'announcements',
            this.presence_user ?
                this.presence_user === this.data.nsoAccount.user.nsaId ? 'user' :
                    {friend: this.presence_user} : null,
            this.presence_user && this.show_active_event ? 'event' : null,
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        if (this.presence_user) {
            if (this.presence_user !== this.data.nsoAccount.user.nsaId) {
                const friend = friends!.find(f => f.nsaId === this.presence_user);

                if (!friend) {
                    throw new Error('User "' + this.presence_user + '" is not friends with this user');
                }

                await this.updatePresenceForDiscord(friend.presence, friend);
            } else {
                await this.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);

        return LoopResult.OK;
    }

    get presence_enabled() {
        return !!this.presence_user;
    }

    rpc: {client: DiscordRPC.Client, id: string} | null = null;
    title: {id: string; since: number} | null = null;
    i = 0;

    last_presence: Presence | null = null;
    last_user: CurrentUser | Friend | undefined = undefined;
    last_friendcode: CurrentUser['links']['friendCode'] | undefined = undefined;
    last_event: ActiveEvent | undefined = undefined;

    async updatePresenceForDiscord(
        presence: Presence | null,
        user?: CurrentUser | Friend,
        friendcode?: CurrentUser['links']['friendCode'],
        activeevent?: ActiveEvent
    ) {
        this.last_presence = presence;
        this.last_user = user;
        this.last_friendcode = friendcode;
        this.last_event = activeevent;

        const online = presence?.state === PresenceState.ONLINE || presence?.state === PresenceState.PLAYING;

        const show_presence =
            (online && 'name' in presence.game) ||
            (this.show_console_online && presence?.state === PresenceState.INACTIVE);

        if (!presence || !show_presence) {
            if (this.presence_enabled && this.discord_preconnect && !this.rpc) {
                debugDiscord('No presence but Discord preconnect enabled - connecting');
                const discordpresence = getInactiveDiscordPresence(PresenceState.OFFLINE, 0);
                const client = await this.createDiscordClient(discordpresence.id);
                this.rpc = {client, id: discordpresence.id};
                return;
            }

            if (this.rpc && !(this.presence_enabled && this.discord_preconnect)) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            } else if (this.rpc && this.title) {
                debugDiscord('No presence but Discord preconnect enabled - clearing Discord activity');
                await this.rpc.client.clearActivity();
            }

            this.title = null;
            return;
        }

        const presencecontext: DiscordPresenceContext = {
            friendcode: this.show_friend_code ? this.force_friend_code ?? friendcode : undefined,
            activeevent,
            znc_discord_presence: this,
            nsaid: this.presence_user!,
            user,
        };

        const discordpresence = 'name' in presence.game ?
            getDiscordPresence(presence.state, presence.game, presencecontext) :
            getInactiveDiscordPresence(presence.state, presence.logoutAt, presencecontext);

        if (this.rpc && this.rpc.id !== discordpresence.id) {
            const client = this.rpc.client;
            this.rpc = null;
            await client.destroy();
        }

        if (!this.rpc) {
            const client = await this.createDiscordClient(discordpresence.id);
            this.rpc = {client, id: discordpresence.id};
        }

        if (discordpresence.title) {
            if (discordpresence.title !== this.title?.id) {
                this.title = {id: discordpresence.title, since: Date.now()};
            }

            if (discordpresence.showTimestamp) {
                discordpresence.activity.startTimestamp = this.title.since;
            }
        } else {
            this.title = null;
        }

        this.rpc.client.setActivity(discordpresence.activity);

        this.update_presence_errors = 0;
    }

    async createDiscordClient(clientid: string) {
        let client: DiscordRPC.Client;
        let attempts = 0;
        let connected = false;

        while (attempts < 10) {
            if (attempts === 0) debugDiscord('RPC connecting', clientid);
            else debugDiscord('RPC connecting, attempt %d', attempts + 1, clientid);

            try {
                client = new DiscordRPC.Client({transport: 'ipc'});
                await client.connect(clientid);
                debugDiscord('RPC connected', clientid, client.application, client.user);
                connected = true;
                break;
            } catch (err) {}

            attempts++;
            await new Promise(rs => setTimeout(rs, 5000));
        }

        if (!connected) throw new Error('Failed to connect to Discord');

        const reconnect = async () => {
            if (this.rpc?.client !== client) return;

            debugDiscord('RPC client disconnected, attempting to reconnect', clientid);
            let attempts = 0;
            let connected = false;

            while (attempts < 10) {
                if (this.rpc?.client !== client) return;

                debugDiscord('RPC reconnecting, attempt %d', attempts + 1, clientid);
                try {
                    const newclient = new DiscordRPC.Client({transport: 'ipc'});
                    await newclient.connect(clientid);
                    debugDiscord('RPC reconnected', clientid, newclient.application, newclient.user);

                    // @ts-expect-error
                    client.transport.on('close', reconnect);

                    this.rpc.client = newclient;
                    client = newclient;
                    connected = true;
                    break;
                } catch (err) {
                    debugDiscord('RPC reconnect failed, attempt %d', attempts + 1, clientid, err);
                }

                attempts++;
                await new Promise(rs => setTimeout(rs, 5000));
            }

            if (!connected) throw new Error('Failed to reconnect to Discord');
        };

        // @ts-expect-error
        client.transport.on('close', reconnect);

        return client!;
    }

    async update() {
        const {friends, user, activeevent} = await this.fetch([
            this.presence_user ?
                this.presence_user === this.data.nsoAccount.user.nsaId ? 'user' :
                    {friend: this.presence_user} : null,
            this.presence_user && this.show_active_event ? 'event' : null,
            this.user_notifications ? 'user' : null,
            this.friend_notifications ? 'friends' : null,
            this.splatnet2_monitors.size ? 'user' : null,
        ]);

        if (this.presence_user) {
            if (this.presence_user !== this.data.nsoAccount.user.nsaId) {
                const friend = friends!.find(f => f.nsaId === this.presence_user);

                if (!friend) {
                    // Is the authenticated user no longer friends with this user?
                    await this.updatePresenceForDiscord(null);
                } else {
                    await this.updatePresenceForDiscord(friend.presence, friend);
                }
            } else {
                await this.updatePresenceForDiscord(user!.presence, user, user!.links.friendCode, activeevent);
            }
        }

        await this.updatePresenceForNotifications(user, friends);
        if (user) await this.updatePresenceForSplatNet2Monitors([user]);
    }

    update_presence_errors = 0;

    async handleError(err: ErrorResponse<ZncErrorResponse> | NodeJS.ErrnoException): Promise<LoopResult> {
        this.update_presence_errors++;

        if (this.update_presence_errors > 2) {
            // Disconnect from Discord if the last two attempts to update presence failed
            // This prevents the user's activity on Discord being stuck
            if (this.rpc) {
                const client = this.rpc.client;
                this.rpc = null;
                await client.destroy();
            }

            this.title = null;
        }

        return super.handleError(err);
    }
}

export class ZncProxyDiscordPresence extends ZncDiscordPresence {
    constructor(
        readonly argv: ArgumentsCamelCase<Arguments>,
        public presence_url: string
    ) {
        super(argv, null!, null!, null!, null!);
    }

    get presence_enabled() {
        return true;
    }

    async init() {
        await this.update();

        return LoopResult.OK;
    }

    async update() {
        const [presence, user] = await getPresenceFromUrl(this.presence_url);

        await this.updatePresenceForDiscord(presence, user);
        await this.updatePresenceForSplatNet2Monitor(presence, this.presence_url);
    }
}
