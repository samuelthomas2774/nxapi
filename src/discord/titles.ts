import { Title } from './util.js';

export const defaultTitle: Title = {
    id: '0000000000000000',
    client: '950883021165330493',
    titleName: true,
    showPlayingOnline: true,
    showActiveEvent: true,
};

const titles: Title[] = [
    {
        // Splatoon 2 [Europe]
        id: '0100f8f0000a2000',
        client: '950886725398429726',
        largeImageKey: '0100f8f0000a2000',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Splatoon 2 [The Americas]
        id: '01003bc0000a0000',
        client: '950886725398429726',
        largeImageKey: '0100f8f0000a2000',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Splatoon 2 [Japan]
        id: '01003c700009c000',
        client: '950886725398429726',
        largeImageKey: '01003c700009c000',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Smash Bros. Ultimate
        id: '01006a800016e000',
        client: '950894516104212490',
        largeImageKey: '01006a800016e000',
        showActiveEvent: true,
    },

    {
        // Mario Kart 8 Deluxe
        id: '0100152000022000',
        client: '950905573149409280',
        largeImageKey: '0100152000022000',
        showActiveEvent: true,
    },

    {
        // Super Mario Odyssey
        id: '0100000000010000',
        client: '950905939899351050',
        largeImageKey: '0100000000010000',
    },

    {
        // Minecraft
        id: '0100d71004694000',
        client: '950906152391168020',
        largeImageKey: '0100d71004694000',
    },
    {
        // Minecraft: Nintendo Switch Edition
        id: '01006bd001e06000',
        client: '950906152391168020',
        largeImageKey: '01006bd001e06000',
    },

    {
        // Nintendo Entertainment System - Nintendo Switch Online
        id: '0100d870045b6000',
        client: '950907272438104064',
        titleName: 'Nintendo Entertainment System',
        largeImageKey: '0100d870045b6000',
    },
    {
        // Super Nintendo Entertainment System - Nintendo Switch Online
        id: '01008d300c50c000',
        client: '950907272438104064',
        titleName: 'Super Nintendo Entertainment System',
        largeImageKey: '01008d300c50c000',
    },
    {
        // Nintendo 64 - Nintendo Switch Online
        id: '0100c9a00ece6000',
        client: '950907272438104064',
        titleName: 'Nintendo 64',
        largeImageKey: '0100c9a00ece6000',
    },
    {
        // SEGA Mega Drive - Nintendo Switch Online
        id: '0100b3c014bda000',
        client: '950907272438104064',
        titleName: 'SEGA Mega Drive',
        largeImageKey: '0100b3c014bda000',
    },

    {
        // Animal Crossing: New Horizons
        id: '01006f8002326000',
        client: '950908097235415079',
        largeImageKey: '01006f8002326000',
    },
    {
        // Animal Crossing: New Horizons Island Transfer Tool
        id: '0100f38011cfe000',
        client: '950908097235415079',
        titleName: 'Island Transfer Tool',
        largeImageKey: '0100f38011cfe000',
    },
];

export default titles;
