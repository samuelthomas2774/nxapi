import DiscordRPC from 'discord-rpc';
import { ActiveEvent, CurrentUser, Game, PresenceState } from '../api/znc-types.js';
import { defaultTitle, titles } from './titles.js';
import { getTitleIdFromEcUrl, hrduration } from '../util.js';
import { ZncDiscordPresence } from '../cli/nso/presence.js';

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

    if (game.sysDescription) text.push(game.sysDescription + event_text);
    else if (online && title.showPlayingOnline === true) text.push('Playing online' + event_text);
    else if (online && title.showPlayingOnline) text.push(title.showPlayingOnline as string + event_text);

    if (game.totalPlayTime >= 60) {
        text.push('Played for ' + hrduration(game.totalPlayTime) +
            ' since ' + (game.firstPlayedAt ? new Date(game.firstPlayedAt * 1000).toLocaleDateString('en-GB') : 'now'));
    }

    const activity: DiscordRPC.Presence = {
        details: text[0],
        state: text[1],
        largeImageKey: title.largeImageKey ?? game.imageUri,
        largeImageText: context?.friendcode ? 'SW-' + context.friendcode.id : undefined,
        smallImageKey: title.smallImageKey,
        buttons: game.shopUri ? [
            {
                label: 'Nintendo eShop',
                url: game.shopUri,
            },
        ] : [],
    };

    if (online && title.showActiveEvent && context?.activeevent?.shareUri) {
        activity.buttons?.push({
            label: 'Join',
            url: context.activeevent.shareUri,
        });
    } else if (online && title.showActiveEvent) {
        activity.buttons?.push({
            label: 'Join via Nintendo Switch',
            url: 'https://lounge.nintendo.com',
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
            largeImageText: context?.friendcode ? 'SW-' + context.friendcode.id : undefined,
        },
    };
}

export interface DiscordPresenceContext {
    friendcode?: CurrentUser['links']['friendCode'];
    activeevent?: ActiveEvent;
    znc_discord_presence?: ZncDiscordPresence;
    nsaid?: string;
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
    /**
     * By default this will not be set.
     */
    smallImageKey?: string;
    /**
     * Whether to show the timestamp the user started playing the title in Discord. Discord shows this as the number of minutes and seconds since the timestamp; this will be inaccurate as it may take up to a minute (by default) to detect the user's presence, so this is disabled by default.
     *
     * @default false
     */
    showTimestamp?: boolean;
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
     * A function to call to customise the Discord activity.
     */
    callback?: (activity: DiscordRPC.Presence, game: Game, context?: DiscordPresenceContext) => void;
}
