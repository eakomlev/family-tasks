const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)

// Веб-просмотр (`npm run web:preview`): у react-native-pager-view нет веб-версии, подставляем заглушку (см. scripts/web-shims).
// Нативные сборки (Android, iPhone) используют настоящий пакет.
const pagerShim = path.resolve(__dirname, 'scripts/web-shims/react-native-pager-view.tsx')
const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-pager-view') return { type: 'sourceFile', filePath: pagerShim }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
