//
// X Rank seasons
//
// X Rank seasons are calculated by the web app, not retrieved from the API.
//

export interface Season {
    /** Season ID use by the API, e.g. "220501T00_220601T00" */
    id: string;
    /** Season ID use by the web app, e.g. "2022_05" */
    key: string;
    index: number;
    start: Date;
    end: Date;
    complete: boolean;
}

export function* getAllSeasons(sort_ascending = false) {
    let season = sort_ascending ? getFirstSeason() : getCurrentSeason();

    while (season) {
        yield season;
        season = sort_ascending ? getNextSeason(season) : getPreviousSeason(season);
    }
}

export function getSeason(year: number, month: number): Season | null
export function getSeason(start: Date): Season | null
export function getSeason(id: string | number): Season | null
export function getSeason(year: number | Date | string, month?: number): Season | null {
    if (year instanceof Date) {
        month = year.getUTCMonth() + 1;
        year = year.getUTCFullYear();
    }
    if (typeof year === 'string') {
        // 180401T00_180601T00
        const match = year.match(/^(\d{2,})(0\d|1[012])01T00_(\d{2,})(0\d|1[012])01T00$/);
        if (!match) throw new Error('Invalid season ID');

        year = 2000 + parseInt(match[1]);
        month = parseInt(match[2]);

        const nextyear = month === 12 ? year + 1 : year;
        const nextmonth = year === 2018 && month === 4 ? 6 :
            month === 12 ? 1 : month + 1;
        if (nextyear !== (2000 + parseInt(match[3])) || nextmonth !== parseInt(match[4])) throw new Error('Invalid season ID');

        if (year === 2018 && month === 5) throw new Error('Invalid season ID');
    }

    const start = typeof month === 'number' ? new Date(Date.UTC(year, month - 1)) :
        getSeasonStartDateByIndex(year);

    if (start.getUTCFullYear() === 2018 && start.getUTCMonth() === 3) {
        start.setUTCMonth(4);
    }

    if (Date.now() < start.getTime()) return null;
    if (start.getUTCFullYear() < 2018 || (start.getUTCFullYear() === 2018 && start.getUTCMonth() < 3)) return null;

    const end = new Date(Date.UTC(
        start.getUTCFullYear() + (start.getUTCMonth() === 11 ? 1 : 0),
        start.getUTCMonth() === 11 ? 0 : start.getUTCMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    if (start.getUTCFullYear() === 2018 && start.getUTCMonth() === 4) {
        start.setUTCMonth(3);
    }

    return {
        id,
        key,
        index: getSeasonIndex(start.getUTCFullYear(), start.getUTCMonth() + 1),
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function getFirstSeason() {
    return getSeason(2018, 5);
}

export function getCurrentSeason() {
    return getSeason(new Date());
}

export function getNextSeason(season: Season | number): Season | null
export function getNextSeason(year: number, month: number): Season | null
export function getNextSeason(season: Season | number, month?: number): Season | null {
    const current_start =
        typeof season === 'number' && typeof month === 'number' ?
            new Date(Date.UTC(season, month)) :
        typeof season === 'number' ? getSeasonStartDateByIndex(season) :
        new Date(season.start.getTime());

    if (current_start.getUTCFullYear() === 2018 && current_start.getUTCMonth() === 3) {
        current_start.setUTCMonth(4);
    }

    const start = new Date(Date.UTC(
        current_start.getUTCFullYear() + (current_start.getUTCMonth() === 11 ? 1 : 0),
        current_start.getUTCMonth() === 11 ? 0 : current_start.getUTCMonth() + 1,
    ));

    if (Date.now() < start.getTime()) return null;

    const end = new Date(Date.UTC(
        start.getUTCFullYear() + (start.getUTCMonth() === 11 ? 1 : 0),
        start.getUTCFullYear() === 2018 && start.getUTCMonth() === 3 ? 5 :
            start.getUTCMonth() === 11 ? 0 : start.getUTCMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    return {
        id,
        key,
        index: getSeasonIndex(start.getUTCFullYear(), start.getUTCMonth() + 1),
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function getPreviousSeason(season: Season | number): Season | null
export function getPreviousSeason(year: number, month: number): Season | null
export function getPreviousSeason(season: Season | number, month?: number): Season | null {
    const current_start =
        typeof season === 'number' && typeof month === 'number' ?
            new Date(Date.UTC(season, month)) :
        typeof season === 'number' ? getSeasonStartDateByIndex(season) :
        new Date(season.start.getTime());

    const start = new Date(Date.UTC(
        current_start.getUTCFullYear() - (current_start.getUTCMonth() === 0 ? 1 : 0),
        current_start.getUTCMonth() === 0 ? 11 : current_start.getUTCMonth() - 1,
    ));

    if (start.getUTCFullYear() < 2018 || (start.getUTCFullYear() === 2018 && start.getUTCMonth() < 3)) return null;

    const end = new Date(Date.UTC(
        start.getUTCFullYear() + (start.getUTCMonth() === 11 ? 1 : 0),
        start.getUTCFullYear() === 2018 && start.getUTCMonth() === 3 ? 5 :
            start.getUTCMonth() === 11 ? 0 : start.getUTCMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    if (start.getUTCFullYear() === 2018 && start.getUTCMonth() === 4) {
        start.setUTCMonth(3);
    }

    return {
        id,
        key,
        index: getSeasonIndex(start.getUTCFullYear(), start.getUTCMonth() + 1),
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function getSeasonIndex(year: number, month: number) {
    const nextyear = month === 12 ? year + 1 : year;

    if (year < 2000) throw new Error('Invalid season ID');
    if (nextyear >= 2100) throw new Error('Invalid season ID');
    if (month < 1) throw new Error('Invalid season ID');
    if (month > 12) throw new Error('Invalid season ID');

    if (year < 2018) throw new Error('Invalid season ID');
    if (year === 2018 && month < 4) throw new Error('Invalid season ID');

    const now = new Date();
    if (year > now.getUTCFullYear()) throw new Error('Invalid season ID');
    if (year === now.getUTCFullYear() && month > (now.getUTCMonth() + 1)) throw new Error('Invalid season ID');

    if (year === 2018 && month === 4) month = 5;

    const i = year * 12 + (month - 1);
    return i - 24220;
}

export function getSeasonStartDateByIndex(index: number) {
    if (index < 0) throw new Error('Invalid season index');

    if (index === 0) return new Date(Date.UTC(2018, 3));

    const i = index + 24220;

    const year = Math.floor(i / 12);
    const month = (i % 12) + 1;

    if (year < 2018) throw new Error('Invalid season index');
    if (year === 2018 && month < 4) throw new Error('Invalid season index');

    const now = new Date();
    if (year > now.getUTCFullYear()) throw new Error('Invalid season index');
    if (year === now.getUTCFullYear() && month > (now.getUTCMonth() + 1)) throw new Error('Invalid season index');

    return new Date(Date.UTC(year, month - 1));
}

export function toSeasonId(year: number, month: number) {
    if (year === 2018 && month === 4) month = 5;

    const nextyear = month === 12 ? year + 1 : year;
    const nextmonth = month === 12 ? 1 : month + 1;

    if (year < 2000) throw new Error('Invalid season ID');
    if (nextyear >= 2100) throw new Error('Invalid season ID');
    if (month < 1) throw new Error('Invalid season ID');
    if (month > 12) throw new Error('Invalid season ID');

    if (year < 2018) throw new Error('Invalid season ID');
    if (year === 2018 && month < 4) throw new Error('Invalid season ID');

    const now = new Date();
    if (year > now.getUTCFullYear()) throw new Error('Invalid season ID');
    if (year === now.getUTCFullYear() && month > (now.getUTCMonth() + 1)) throw new Error('Invalid season ID');

    if (year === 2018 && month === 5) month = 4;

    return ('' + (year - 2000)).padStart(2, '0') +
        ('' + month).padStart(2, '0') +
        '01T00_' +
        ('' + (nextyear - 2000)).padStart(2, '0') +
        ('' + nextmonth).padStart(2, '0') +
        '01T00';
}

export enum Rule {
    SPLAT_ZONES = 'splat_zones',
    TOWER_CONTROL = 'tower_control',
    RAINMAKER = 'rainmaker',
    CLAM_BLITZ = 'clam_blitz',
}
