import { AppRegistry } from 'react-native';
import { config } from './ipc.js';
import App from './app.jsx';
import Friend from './friend/index.js';

AppRegistry.registerComponent('App', () => App);
AppRegistry.registerComponent('Friend', () => Friend);

const style = window.document.createElement('style');

style.textContent = `
html {
    user-select: none;
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
