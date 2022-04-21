import { Title } from './util.js';
import * as publishers from './titles/index.js';

export const defaultTitle: Title = {
    id: '0000000000000000',
    client: '950883021165330493',
    titleName: true,
    showPlayingOnline: true,
    showActiveEvent: true,
};

export const titles: Title[] = [];

for (const [publisher, m] of Object.entries(publishers)) {
    if (!('titles' in m)) continue;

    for (const title of m.titles) {
        titles.push(title);
    }
}
