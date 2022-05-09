// @ts-expect-error
import __Table from 'cli-table/lib/index.js';

export type Cell = string | number;
export type Row = Cell[];

export enum CellAlign {
    LEFT = 'left',
    MIDDLE = 'middle',
    RIGHT = 'right',
}

export enum Style {
    BLACK = 'black',
    RED = 'red',
    GREEN = 'green',
    YELLOW = 'yellow',
    BLUE = 'blue',
    MAGENTA = 'magenta',
    CYAN = 'cyan',
    WHITE = 'white',
    GREY = 'grey',

    BRIGHTRED = 'brightRed',
    BRIGHTGREEN = 'brightGreen',
    BRIGHTYELLOW = 'brightYellow',
    BRIGHTBLUE = 'brightBlue',
    BRIGHTMAGENTA = 'brightMagenta',
    BRIGHTCYAN = 'brightCyan',
    BRIGHTWHITE = 'brightWhite',

    BG_BLACK = 'bgBlack',
    BG_RED = 'bgRed',
    BG_GREEN = 'bgGreen',
    BG_YELLOW = 'bgYellow',
    BG_BLUE = 'bgBlue',
    BG_MAGENTA = 'bgMagenta',
    BG_CYAN = 'bgCyan',
    BG_WHITE = 'bgWhite',
    BG_GREY = 'bgGrey',

    BG_BRIGHTRED = 'bgBrightRed',
    BG_BRIGHTGREEN = 'bgBrightGreen',
    BG_BRIGHTYELLOW = 'bgBrightYellow',
    BG_BRIGHTBLUE = 'bgBrightBlue',
    BG_BRIGHTMAGENTA = 'bgBrightMagenta',
    BG_BRIGHTCYAN = 'bgBrightCyan',
    BG_BRIGHTWHITE = 'bgBrightWhite',

    RESET = 'reset',
    BOLD = 'bold',
    DIM = 'dim',
    ITALIC = 'italic',
    UNDERLINE = 'underline',
    INVERSE = 'inverse',
    HIDDEN = 'hidden',
    STRIKETHROUGH = 'strikethrough',

    RAINBOW = 'rainbow',
    ZEBRA = 'zebra',
    AMERICA = 'america',
    TRAP = 'trap',
    RANDOM = 'random',
}

export interface TableOptions {
    chars: {
        'top': string;
        'top-mid': string;
        'top-left': string;
        'top-right': string;
        'bottom': string;
        'bottom-mid': string;
        'bottom-left': string;
        'bottom-right': string;
        'left': string;
        'left-mid': string;
        'mid': string;
        'mid-mid': string;
        'right': string;
        'right-mid': string;
        'middle': string;
    };
    truncate: string;
    colWidths: number[];
    colAligns: CellAlign[];
    style: {
        'padding-left': number;
        'padding-right': number;
        /** @default [Style.RED] */
        head: Style[];
        /** @default [Style.GREY] */
        border: Style[];
        compact: boolean;
    };
    head: Row;
    rows: Row[];
}

type RecursivePartial<T extends {}> = {
    [P in keyof T]?: (T[P] extends Array<unknown> ? T[P] : RecursivePartial<T[P]>) | undefined;
};

export type PartialTableOptions = RecursivePartial<TableOptions>;

declare class Table extends Array<Row> {
    options: TableOptions;
    constructor(options: PartialTableOptions);
    /**
     * Width getter
     */    
    get width(): number;
    /**
     * Render to a string.
     */
    render(): string;
    /**
     * Render to a string.
     */
    toString(): string;
    static version: string;
}

const _Table: typeof Table = __Table;
type _Table = Table;

export default _Table;
