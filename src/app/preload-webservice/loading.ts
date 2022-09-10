import createDebug from 'debug';

const debug = createDebug('app:preload-webservice:loading');

if (location.href === 'about:blank') {
    const BACKGROUND_COLOUR_MAIN_LIGHT = process.platform === 'win32' ? '#ffffff' : '#ececec';
    const BACKGROUND_COLOUR_MAIN_DARK = process.platform === 'win32' ? '#000000' : '#252424';

    const style = window.document.createElement('style');

    style.textContent = `
    :root {
        background-color: ${BACKGROUND_COLOUR_MAIN_DARK};
    }
    @media (prefers-color-scheme: light) {
        :root {
            background-color: ${BACKGROUND_COLOUR_MAIN_LIGHT};
        }
    }
    `;

    document.addEventListener('DOMContentLoaded', () => {
        (document.scrollingElement as HTMLElement).style.overflow = 'hidden';
        window.document.head.appendChild(style);
    });
}
