//
// Parse HTTP Link headers
//
// Based on https://github.com/thlorenz/parse-link-header
//

function parseLink(link: string) {
    const match = link.match(/<?([^>]*)>((;.*)*)/);
    if (!match) return null;

    const uri = match[1];
    const parameters_str = match[2].split(';');

    // Reuse URLSearchParams for link parameters
    const parameters = new URLSearchParams();

    for (const parameter of parameters_str) {
        // rel="next" => 1: rel 2: next
        const match = parameter.match(/\s*(.+)\s*=\s*("([^"]*)"|[^\b]+)?/);
        if (!match) continue;

        const key = match[1];
        const value = match[3] ?? match[2];

        parameters.append(key, value);
    }

    const rel = (parameters.get('rel') ?? '').split(' ').filter(r => r);

    return {
        uri,
        parameters,
        rel,
        type: parameters.get('type'),
    };
}

export function parseLinkHeader(link_header: string) {
    const links = [];

    for (const link_str of link_header.split(/,\s*</)) {
        const link = parseLink(link_str);
        if (link) links.push(link);
    }

    return links;
}
