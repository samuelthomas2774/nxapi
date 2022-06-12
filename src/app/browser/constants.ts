import ipc from './ipc.js';

export const NSO_COLOUR = '#e60012';
export const NSO_COLOUR_DARK: `${typeof NSO_COLOUR}e0` = `${NSO_COLOUR}e0`;
export const DISCORD_COLOUR = '#5865f2';

export const BACKGROUND_COLOUR_MAIN_LIGHT = ipc.platform === 'win32' ? '#ffffff' : '#ececec';
export const BACKGROUND_COLOUR_MAIN_DARK = ipc.platform === 'win32' ? '#000000' : '#252424';

export const BACKGROUND_COLOUR_SECONDARY_LIGHT = '#ffffff';
export const BACKGROUND_COLOUR_SECONDARY_DARK = '#353535';

export const UPDATE_COLOUR = '#006064e0';

export const HIGHLIGHT_COLOUR_LIGHT = '#00000020';
export const HIGHLIGHT_COLOUR_DARK = '#ffffff20';

export const BORDER_COLOUR_LIGHT = '#00000020';
export const BORDER_COLOUR_DARK = '#00000080';
export const BORDER_COLOUR_SECONDARY_DARK = '#ffffff20';

export const TEXT_COLOUR_LIGHT = '#212121';
export const TEXT_COLOUR_DARK = '#f5f5f5';
export const TEXT_COLOUR_ACTIVE = '#3ba55d';

export const DEFAULT_ACCENT_COLOUR = NSO_COLOUR.substr(1).toUpperCase() + 'FF';
