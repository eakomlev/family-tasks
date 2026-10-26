const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)

// Веб-просмотр (`npm run web:preview`): у некоторых нативных пакетов нет веб-версии, подставляем заглушки (см. scripts/web-shims):
// react-native-pager-view (листание страниц) и expo-secure-store (хранение токена входа в localStorage).
// Нативные сборки (Android, iPhone) используют настоящие пакеты.
const shims = {
  'react-native-pager-view': path.resolve(__dirname, 'scripts/web-shims/react-native-pager-view.tsx'),
  'expo-secure-store': path.resolve(__dirname, 'scripts/web-shims/expo-secure-store.ts'),
}
const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && shims[moduleName]) return { type: 'sourceFile', filePath: shims[moduleName] }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
