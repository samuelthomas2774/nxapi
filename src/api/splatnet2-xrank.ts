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
    start: Date;
    end: Date;
    complete: boolean;
}

export function* getAllSeasons(sort_ascending = false) {
    let season = sort_ascending ? FIRST_SEASON : CURRENT_SEASON;

    while (season) {
        yield season;
        season = sort_ascending ? getNextSeason(season) : getPreviousSeason(season);
    }
}

export function getSeason(year: number, month: number): Season | null
export function getSeason(start: Date): Season | null
export function getSeason(id: string): Season | null
export function getSeason(year: number | Date | string, month?: number): Season | null {
    if (year instanceof Date) {
        month = year.getUTCMonth() + 1;
        year = year.getUTCFullYear();
    }
    if (typeof year === 'string') {
        // 180401T00_180601T00
        const match = year.match(/^(\d{2,})(0\d,1[012])01T00_(\d{2,})(0\d,1[012])01T00$/);
        if (!match) throw new Error('Invalid season ID');

        year = 2000 + parseInt(match[1]);
        month = parseInt(match[2]);

        const nextyear = month === 12 ? year + 1 : year;
        const nextmonth = year === 2018 && month === 4 ? 6 :
            month === 12 ? 1 : month + 1;
        if (nextyear !== parseInt(match[3]) || nextmonth !== parseInt(match[4])) throw new Error('Invalid season ID');
    }

    const start = new Date(Date.UTC(year, month! - 1));

    if (Date.now() < start.getTime()) return null;
    if (start.getUTCFullYear() < 2018 || (start.getUTCFullYear() === 2018 && start.getUTCMonth() < 3)) return null;

    const end = new Date(Date.UTC(
        start.getFullYear() + (start.getMonth() === 11 ? 1 : 0),
        start.getMonth() === 11 ? 0 : start.getMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    if (start.getUTCFullYear() === 2018 && start.getUTCMonth() === 4) {
        start.setUTCMonth(3);
    }

    return {
        id,
        key,
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function getFirstSeason() {
    return getSeason(2018, 5);
}

const FIRST_SEASON = getFirstSeason();
const CURRENT_SEASON = getSeason(new Date());

export function getNextSeason(season: Season): Season | null
export function getNextSeason(year: number, month: number): Season | null
export function getNextSeason(season: Season | number, month?: number): Season | null {
    const current_start = typeof season === 'number' ? new Date(Date.UTC(season, month!)) : season.start;

    if (current_start.getUTCFullYear() === 2018 && current_start.getUTCMonth() === 3) {
        current_start.setUTCMonth(4);
    }

    const start = new Date(Date.UTC(
        current_start.getFullYear() + (current_start.getMonth() === 11 ? 1 : 0),
        current_start.getMonth() === 11 ? 0 : current_start.getMonth() + 1,
    ));

    if (Date.now() < start.getTime()) return null;

    const end = new Date(Date.UTC(
        start.getFullYear() + (start.getMonth() === 11 ? 1 : 0),
        start.getMonth() === 11 ? 0 : start.getMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    return {
        id,
        key,
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function getPreviousSeason(season: Season): Season | null
export function getPreviousSeason(year: number, month: number): Season | null
export function getPreviousSeason(season: Season | number, month?: number): Season | null {
    const current_start = typeof season === 'number' ? new Date(Date.UTC(season, month!)) : season.start;

    const start = new Date(Date.UTC(
        current_start.getFullYear() - (current_start.getMonth() === 0 ? 1 : 0),
        current_start.getMonth() === 0 ? 11 : current_start.getMonth() - 1,
    ));

    if (start.getUTCFullYear() < 2018 || (start.getUTCFullYear() === 2018 && start.getUTCMonth() < 3)) return null;

    const end = new Date(Date.UTC(
        start.getFullYear() + (start.getMonth() === 11 ? 1 : 0),
        start.getMonth() === 11 ? 0 : start.getMonth() + 1,
    ));

    const id = toSeasonId(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const key = start.getUTCFullYear() + '_' + ('' + (start.getUTCMonth() + 1)).padStart(2, '0');

    if (start.getUTCFullYear() === 2018 && start.getUTCMonth() === 4) {
        start.setUTCMonth(3);
    }

    return {
        id,
        key,
        start,
        end,
        complete: Date.now() > end.getTime(),
    };
}

export function toSeasonId(year: number, month: number) {
    const nextyear = month === 12 ? year + 1 : year;
    const nextmonth = month === 12 ? 1 : month + 1;

    if (year < 2000) throw new Error('Invalid season ID');
    if (nextyear >= 2100) throw new Error('Invalid season ID');

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
