
export function getTitleIdFromEcUrl(url: string) {
    const match = url.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);
    return match?.[1] ?? null;
}

export function hrduration(duration: number, short = false) {
    const hours = Math.floor(duration / 60);
    const minutes = duration - (hours * 60);

    const hour_str = short ? 'hr' : 'hour';
    const minute_str = short ? 'min' : 'minute';

    if (hours >= 1) {
        return hours + ' ' + hour_str + (hours === 1 ? '' : 's') +
            (minutes ? ', ' + minutes + ' ' + minute_str + (minutes === 1 ? '' : 's') : '');
    } else {
        return minutes + ' ' + minute_str + (minutes === 1 ? '' : 's');
    }
}

export function hrlist(items: string[]) {
    if (!items.length) throw new Error('list must not be empty');
    if (items.length === 1) return items[0];

    const last = items[items.length - 1];
    return items.slice(0, -1).join(', ') + ' and ' + last;
}

export function timeoutSignal(ms = 60 * 1000) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort(new Error('Timeout'));
    }, ms);

    return [controller.signal, () => clearTimeout(timeout)] as const;
}
