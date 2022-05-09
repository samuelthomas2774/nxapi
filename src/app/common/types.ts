import type { AppProps } from '../browser/app.js';

export enum WindowType {
    MAIN_WINDOW = 'App',
}

interface WindowProps {
    [WindowType.MAIN_WINDOW]: AppProps;
}

export interface WindowConfiguration<T extends WindowType = WindowType> {
    type: T;
    props: WindowProps[T];
}
