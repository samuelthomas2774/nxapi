import createDebug from 'debug';
import persist from 'node-persist';
import notifier from 'node-notifier';
import { CurrentUser, Friend, Game, PresenceState } from '../../api/znc-types.js';
import ZncApi from '../../api/znc.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, getTitleIdFromEcUrl, getToken, hrduration, initStorage, SavedToken, YargsArguments } from '../../util.js';
import ZncProxyApi from '../../api/znc-proxy.js';

const debug = createDebug('cli:nso:notify');
const debugFriends = createDebug('cli:nso:notify:friends');

export const command = 'notify';
export const desc = 'Show notifications when friends come online without starting Discord Rich Presence';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('user-notifications', {
        describe: 'Show notification for your own user',
        type: 'boolean',
        default: false,
    }).option('friend-notifications', {
        describe: 'Show notification for friends',
        type: 'boolean',
        default: true,
    }).option('update-interval', {
        describe: 'Update interval in seconds',
        type: 'number',
        default: 30,
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (!argv.userNotifications && !argv.friendNotifications) {
        throw new Error('Must enable either user or friend notifications');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const i = new ZncNotifications(argv, storage, token, nso, data);

    console.warn('Authenticated as Nintendo Account %s (NA %s, NSO %s)',
        data.user.screenName, data.user.nickname, data.nsoAccount.user.name);

    await i.init();

    while (true) {
        await i.loop();
    }
}

export class ZncNotifications {
    constructor(
        readonly argv: ArgumentsCamelCase<Arguments>,
        public storage: persist.LocalStorage,
        public token: string,
        public nso: ZncApi,
        public data: Omit<SavedToken, 'expires_at'>,
    ) {}

    async init() {
        const announcements = await this.nso.getAnnouncements();
        const friends = this.argv.friendNotifications || !(this.nso instanceof ZncProxyApi) ?
            await this.nso.getFriendList() : {result: {friends: []}};
        if (!(this.nso instanceof ZncProxyApi)) {
            const webservices = await this.nso.getWebServices();
            const activeevent = await this.nso.getActiveEvent();
        }

        if (this.argv.userNotifications) {
            const user = await this.nso.getCurrentUser();

            await this.updateFriendsStatusForNotifications(this.argv.friendNotifications ?
                [user.result, ...friends.result.friends] : [user.result]);
        } else {
            await this.updateFriendsStatusForNotifications(friends.result.friends);
        }

        await new Promise(rs => setTimeout(rs, this.argv.updateInterval * 1000));
    }

    onFriendOnline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendOffline(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        notifier.notify({
            title: friend.name,
            message: 'Offline',
            icon: friend.imageUri,
        });
    }

    onFriendPlayingChangeTitle(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onFriendTitleStateChange(friend: CurrentUser | Friend, prev?: CurrentUser | Friend, ir?: boolean) {
        const currenttitle = friend.presence.game as Game;

        notifier.notify({
            title: friend.name,
            message: 'Playing ' + currenttitle.name +
                (currenttitle.sysDescription ? '\n' + currenttitle.sysDescription : ''),
            // icon: currenttitle.imageUri,
            icon: friend.imageUri,
        });
    }

    onlinefriends: (CurrentUser | Friend)[] = [];

    async updateFriendsStatusForNotifications(friends: (CurrentUser | Friend)[], initialRun?: boolean) {
        const newonlinefriends: (CurrentUser | Friend)[] = [];

        for (const friend of friends) {
            const prev = this.onlinefriends.find(f => f.nsaId === friend.nsaId);
            const lastpresence = prev?.presence;
            const online = friend.presence.state === PresenceState.ONLINE ||
                friend.presence.state === PresenceState.PLAYING;
            const wasonline = lastpresence?.state === PresenceState.ONLINE ||
                lastpresence?.state === PresenceState.PLAYING;

            if (!wasonline && online) {
                // Friend has come online
                const currenttitle = friend.presence.game as Game;

                debugFriends('%s is now online%s%s, title %s %s - played for %s since %s', friend.name,
                    friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                    lastpresence ? ' (console was already online)' : '',
                    currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                    hrduration(currenttitle.totalPlayTime),
                    new Date((currenttitle.firstPlayedAt ?? 0) * 1000).toString());

                this.onFriendOnline(friend, prev, initialRun);

                newonlinefriends.push(friend);

                if (lastpresence) {
                    // Friend's console was already online
                }
            } else if (wasonline && !online) {
                // Friend has gone offline
                const lasttitle = lastpresence.game as Game;

                debugFriends('%s is now offline%s, was playing title %s %s', friend.name,
                    friend.presence.state !== PresenceState.OFFLINE ? ' (console still online)' : '',
                    lasttitle.name, JSON.stringify(lasttitle.sysDescription));

                this.onFriendOffline(friend, prev, initialRun);

                if (friend.presence.state !== PresenceState.OFFLINE) {
                    // Friend's console is still online
                    newonlinefriends.push(friend);
                }
            } else if (wasonline && online) {
                // Friend is still online
                const lasttitle = lastpresence.game as Game;
                const currenttitle = friend.presence.game as Game;

                if (getTitleIdFromEcUrl(lasttitle.shopUri) !== getTitleIdFromEcUrl(currenttitle.shopUri)) {
                    // Friend is playing a different title

                    debugFriends('%s title is now %s %s%s, was playing %s %s%s - played for %s since %s',
                        friend.name,
                        currenttitle.name, JSON.stringify(currenttitle.sysDescription),
                        friend.presence.state === PresenceState.ONLINE ? '' : ' (' + friend.presence.state + ')',
                        lasttitle.name, JSON.stringify(lasttitle.sysDescription),
                        lastpresence.state === PresenceState.ONLINE ? '' : ' (' + lastpresence.state + ')',
                        hrduration(currenttitle.totalPlayTime),
                        new Date((currenttitle.firstPlayedAt ?? 0) * 1000).toString());

                    this.onFriendPlayingChangeTitle(friend, prev, initialRun);
                } else if (
                    lastpresence.state !== friend.presence.state ||
                    lasttitle.sysDescription !== currenttitle.sysDescription
                ) {
                    // Title state changed

                    debugFriends('%s title %s state changed, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));

                    this.onFriendTitleStateChange(friend, prev, initialRun);
                } else if (
                    lastpresence.state !== friend.presence.state ||
                    lasttitle.sysDescription !== currenttitle.sysDescription
                ) {
                    // Presence state changed (between online/playing)

                    debugFriends('%s title %s state changed%s, now %s %s, was %s %s',
                        friend.name, currenttitle.name,
                        friend.presence.state, JSON.stringify(currenttitle.sysDescription),
                        lastpresence.state, JSON.stringify(lasttitle.sysDescription));
                }

                newonlinefriends.push(friend);
            } else if (!lastpresence && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is now online, but the user is not playing

                debugFriends('%s\'s console is now online', friend.name);

                newonlinefriends.push(friend);
            } else if (lastpresence && friend.presence.state !== PresenceState.OFFLINE) {
                // Friend's console is still online, the user is still not playing

                newonlinefriends.push(friend);
            } else if (lastpresence && friend.presence.state === PresenceState.OFFLINE) {
                // Friend's console is now offline

                debugFriends('%s\'s console is now offline', friend.name);
            }
        }

        this.onlinefriends = newonlinefriends;
    }

    async update() {
        debug('Updating presence');

        if (this.argv.friendNotifications) {
            if (!(this.nso instanceof ZncProxyApi)) await this.nso.getActiveEvent();
            const friends = this.argv.friendNotifications || !(this.nso instanceof ZncProxyApi) ?
                await this.nso.getFriendList() : {result: {friends: []}};
            if (!(this.nso instanceof ZncProxyApi)) await this.nso.getWebServices();

            if (this.argv.userNotifications) {
                const user = await this.nso.getCurrentUser();

                await this.updateFriendsStatusForNotifications([user.result, ...friends.result.friends]);
            } else {
                await this.updateFriendsStatusForNotifications(friends.result.friends);
            }
        } else {
            const user = await this.nso.getCurrentUser();

            await this.updateFriendsStatusForNotifications([user.result]);
        }

        debug('Updated presence');
    }

    async loop() {
        try {
            await this.update();

            await new Promise(rs => setTimeout(rs, this.argv.updateInterval * 1000));
        } catch (err) {
            // @ts-expect-error
            if (err?.data?.status === 9404) {
                // Token expired
                debug('Renewing token');

                const data = await this.nso.renewToken(this.token);

                const existingToken: SavedToken = {
                    ...data,
                    expires_at: Date.now() + (data.credential.expiresIn * 1000),
                };

                await this.storage.setItem('NsoToken.' + this.token, existingToken);
            } else {
                throw err;
            }
        }
    }
}
