/**
 * Registers the share extension component with AppRegistry.
 *
 * Both the main app and the share extension load the same JS bundle.
 * The main app uses module name "main", the extension uses "shareExtension".
 *
 * Import this file as a side-effect in app/_layout.tsx:
 *   import '@/components/share-extension';
 */

import { AppRegistry } from 'react-native';
import { ShareExtensionRoot } from './ShareExtensionRoot';

AppRegistry.registerComponent('shareExtension', () => ShareExtensionRoot);
