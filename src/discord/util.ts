import DiscordRPC from 'discord-rpc';
import { CurrentUser, Game, PresenceState } from '../api/znc-types.js';
import titles, { defaultTitle } from './titles.js';
import { getTitleIdFromEcUrl, hrduration } from '../util.js';

export function getDiscordPresence(
    state: PresenceState, game: Game,
    friendcode?: CurrentUser['links']['friendCode']
): DiscordPresence {
    const titleid = getTitleIdFromEcUrl(game.shopUri);
    const title = titles.find(t => t.id === titleid) || defaultTitle;

    const text = [];

    if (title.titleName === true) text.push(game.name);
    else if (title.titleName) text.push(title.titleName);

    if (game.sysDescription) text.push(game.sysDescription);
    else if (state === PresenceState.PLAYING && title.showPlayingOnline === true) text.push('Playing online');
    else if (state === PresenceState.PLAYING && title.showPlayingOnline) text.push(title.showPlayingOnline as string);

    if (game.totalPlayTime >= 60) {
        text.push('Played for ' + hrduration(game.totalPlayTime) +
            ' since ' + (game.firstPlayedAt ? new Date(game.firstPlayedAt * 1000).toLocaleDateString('en-GB') : 'now'));
    }

    const activity: DiscordRPC.Presence = {
        details: text[0],
        state: text[1],
        largeImageKey: title.largeImageKey ?? game.imageUri,
        largeImageText: friendcode ? 'SW-' + friendcode.id : undefined,
        smallImageKey: title.smallImageKey,
        buttons: game.shopUri ? [
            {
                label: 'Nintendo eShop',
                url: game.shopUri,
            },
        ] : [],
    };

    title.callback?.call(null, activity, game);

    return {
        id: title.client || defaultTitle.client,
        title: titleid,
        activity,
        showTimestamp: title.showTimestamp,
    };
}

export function getInactiveDiscordPresence(
    state: PresenceState, logoutAt: number,
    friendcode?: CurrentUser['links']['friendCode']
): DiscordPresence {
    return {
        id: defaultTitle.client,
        title: null,
        activity: {
            state: 'Not playing',
            largeImageKey: 'nintendoswitch',
            largeImageText: friendcode ? 'SW-' + friendcode.id : undefined,
        },
    };
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
    /** Lowercase hexadecimal title ID */
    id: string;
    /** Discord client ID */
    client: string;

    titleName?: string | boolean;
    largeImageKey?: string;
    smallImageKey?: string;
    showTimestamp?: boolean;
    /** Show "Playing online" if playing online and the game doesn't set activity details */
    showPlayingOnline?: string | boolean;
}
