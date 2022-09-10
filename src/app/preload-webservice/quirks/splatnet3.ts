import createDebug from 'debug';
import { events, webservice } from '../ipc.js';

const debug = createDebug('app:preload-webservice:quirks:splatnet3');

const SPLATNET3_WEBSERVICE_ID = 4834290508791808;

if (webservice.id === SPLATNET3_WEBSERVICE_ID) {
    const style = window.document.createElement('style');

    style.textContent = `
    [class*=NavigationBar_exitButton] {
        display: none;
    }
    `;

    document.addEventListener('DOMContentLoaded', () => {
        window.document.head.appendChild(style);
    });
    
    events.on('window:refresh', () => {
        const pulltorefresh_container = document.querySelector<HTMLElement>('[class*=PullToRefresh_container]');
        debug('PullToRefresh container HTMLElement', pulltorefresh_container);
        if (!pulltorefresh_container) return location.reload();

        const keys = Object.keys(pulltorefresh_container) as (keyof typeof pulltorefresh_container)[];
        const react_fiber: any = pulltorefresh_container[keys.find(k => k.startsWith('__reactFiber$'))!];
        debug('PullToRefresh container React fiber', react_fiber);
        if (!react_fiber) return location.reload();
        
        try {
            const props = react_fiber.return.return.memoizedProps;
            debug('PullToRefresh root props', props);
            props.onRefresh.call(null);
        } catch (err) {
            debug('Error triggering refresh, forcing full page reload', err);
            location.reload();
        }
    });
}
