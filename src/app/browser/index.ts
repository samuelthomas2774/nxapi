import { AppRegistry } from 'react-native';
import { config } from './ipc.js';
import App from './app.jsx';

AppRegistry.registerComponent('App', () => App);

const rootTag = window.document.createElement('div');

rootTag.style.minHeight = '100vh';
window.document.body.appendChild(rootTag);

AppRegistry.runApplication(config.type, {
    rootTag,
    initialProps: config.props,
});
