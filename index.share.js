/**
 * Entry point for the iOS share extension bundle.
 *
 * In production builds, Xcode bundles this file separately.
 * In dev, Metro serves the full app bundle (which also includes
 * this registration via the side-effect import in app/_layout.tsx),
 * but we keep this file as a standalone entry to ensure the
 * "shareExtension" component is always registered.
 */

import { AppRegistry } from 'react-native';
import { ShareExtensionRoot } from './components/share-extension/ShareExtensionRoot';

AppRegistry.registerComponent('shareExtension', () => ShareExtensionRoot);
