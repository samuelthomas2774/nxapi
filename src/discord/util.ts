import DiscordRPC from 'discord-rpc';
import { ActiveEvent, CurrentUser, Friend, Game, PresenceState } from '../api/znc-types.js';
import { defaultTitle, titles } from './titles.js';
import { dev, getTitleIdFromEcUrl, hrduration, version } from '../util.js';
import { ZncDiscordPresence } from '../cli/nso/presence.js';

const product = 'nxapi ' + version +
    (dev ? '-' + dev.revision.substr(0, 7) + (dev.branch ? ' (' + dev.branch + ')' : '') : '');

export function getDiscordPresence(
    state: PresenceState, game: Game, context?: DiscordPresenceContext
): DiscordPresence {
    const titleid = getTitleIdFromEcUrl(game.shopUri);
    const title = titles.find(t => t.id === titleid) || defaultTitle;

    const text = [];

    if (title.titleName === true) text.push(game.name);
    else if (title.titleName) text.push(title.titleName);

    const online = state === PresenceState.PLAYING;
    const members = context?.activeevent?.members.filter(m => m.isPlaying);
    const event_text = title.showActiveEvent && context?.activeevent ?
        ' (' + members?.length + ' player' + (members?.length === 1 ? '' : 's') +
        ')' : '';

    if ((title.showDescription ?? true) && game.sysDescription) text.push(game.sysDescription + event_text);
    else if (online && title.showPlayingOnline === true) text.push('Playing online' + event_text);
    else if (online && title.showPlayingOnline) text.push(title.showPlayingOnline as string + event_text);

    if ((title.showPlayTime ?? true) && game.totalPlayTime >= 60) {
        text.push('Played for ' + hrduration(game.totalPlayTime) +
            ' since ' + (game.firstPlayedAt ? new Date(game.firstPlayedAt * 1000).toLocaleDateString('en-GB') : 'now'));
    }

    const activity: DiscordRPC.Presence = {
        details: text[0],
        state: text[1],
        largeImageKey: title.largeImageKey ?? game.imageUri,
        largeImageText: title.largeImageText ? title.largeImageText + ' | ' + product : product,
        smallImageKey: title.smallImageKey || (context?.friendcode ? context?.user?.imageUri : undefined),
        smallImageText: title.smallImageKey ? title.smallImageText :
            context?.friendcode && context?.user?.imageUri ? 'SW-' + context.friendcode.id : undefined,
        buttons: game.shopUri ? [
            {
                label: 'Nintendo eShop',
                url: game.shopUri,
            },
        ] : [],
    };

    if (online && title.showActiveEvent) {
        activity.buttons!.push({
            label: context?.activeevent?.shareUri ? 'Join' : 'Join via Nintendo Switch',
            url: context?.activeevent?.shareUri ?? 'https://lounge.nintendo.com',
        });
    }

    title.callback?.call(null, activity, game, context);

    return {
        id: title.client || defaultTitle.client,
        title: titleid,
        activity,
        showTimestamp: title.showTimestamp,
    };
}

export function getInactiveDiscordPresence(
    state: PresenceState, logoutAt: number, context?: DiscordPresenceContext
): DiscordPresence {
    return {
        id: defaultTitle.client,
        title: null,
        activity: {
            state: 'Not playing',
            largeImageKey: 'nintendoswitch',
            largeImageText: product,
            smallImageKey: context?.friendcode ? context?.user?.imageUri : undefined,
            smallImageText: context?.friendcode && context?.user?.imageUri ? 'SW-' + context.friendcode.id : undefined,
        },
    };
}

export interface DiscordPresenceContext {
    friendcode?: CurrentUser['links']['friendCode'];
    activeevent?: ActiveEvent;
    znc_discord_presence?: ZncDiscordPresence;
    nsaid?: string;
    user?: CurrentUser | Friend;
}

export interface DiscordPresence {
    id: string;
    title: string | null;
    activity: DiscordRPC.Presence;
    showTimestamp?: boolean;
}

export function getTitleConfiguration(game: Game, id: string) {
    return titles.find(title => {
        if (title.id !== id) return false;

        return true;
    });
}

export interface Title {
    /**
     * Lowercase hexadecimal title ID.
     *
     * Valid title IDs are 16 characters long, and should start with `0100` and end with `0000`, `2000`, `4000`, `6000`, `8000`, `a000`, `c000`, `e000` (this is because applications have 4^16 title IDs for the application itself, plus addon content and update data).
     */
    id: string;
    /**
     * Discord client ID
     */
    client: string;

    /**
     * Title name to show in Discord. This is *not* the name that will appear under the user's name after "Playing ".
     *
     * If this is set to true the title's name from znc will be used.
     * If this is set to false (default) no title name will be set. This should be used when a specific Discord client for the title is used.
     * If this is set to a string it will be used as the title name.
     *
     * @default false
     */
    titleName?: string | boolean;
    /**
     * By default the title's icon from znc will be used. (No icons need to be uploaded to Discord.)
     */
    largeImageKey?: string;
    largeImageText?: string;
    /**
     * By default this will not be set.
     */
    smallImageKey?: string;
    smallImageText?: string;
    /**
     * Whether to show the timestamp the user started playing the title in Discord. Discord shows this as the number of minutes and seconds since the timestamp; this will be inaccurate as it may take up to a minute (by default) to detect the user's presence, so this is disabled by default.
     *
     * @default false
     */
    showTimestamp?: boolean;
    /**
     * Show the activity description set by the title.
     *
     * @default true
     */
    showDescription?: boolean;
    /**
     * Show "Playing online" if playing online and the game doesn't set activity details.
     *
     * @default false
     */
    showPlayingOnline?: string | boolean;
    /**
     * Whether to show details of the current event (Online Lounge/voice chat) in Discord.
     *
     * @default false
     */
    showActiveEvent?: boolean;
    /**
     * Whether to show "Played for ... since ..." in Discord.
     *
     * @default true
     */
    showPlayTime?: boolean;

    /**
     * A function to call to customise the Discord activity.
     */
    callback?: (activity: DiscordRPC.Presence, game: Game, context?: DiscordPresenceContext) => void;
}
