import { AppRegistry } from 'react-native';
import { config } from './ipc.js';
import App from './main/index.js';
import Friend from './friend/index.js';
import DiscordSetup from './discord/index.js';
import AddFriend from './add-friend/index.js';

AppRegistry.registerComponent('App', () => App);
AppRegistry.registerComponent('Friend', () => Friend);
AppRegistry.registerComponent('DiscordPresence', () => DiscordSetup);
AppRegistry.registerComponent('AddFriend', () => AddFriend);

const style = window.document.createElement('style');

style.textContent = `
:root {
    user-select: none;
    overflow-x: hidden;
}
*:focus-visible {
    outline-style: solid;
    outline-width: medium;
}
input,
input:focus-visible {
    outline: none 0;
}
`;

window.document.head.appendChild(style);

const rootTag = window.document.createElement('div');

rootTag.style.minHeight = '100vh';
window.document.body.appendChild(rootTag);

AppRegistry.runApplication(config.type, {
    rootTag,
    initialProps: config.props,
});
