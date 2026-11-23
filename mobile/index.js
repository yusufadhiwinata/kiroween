/**
 * @format
 */
// Polyfills must load before anything that uses crypto.getRandomValues or URL.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
