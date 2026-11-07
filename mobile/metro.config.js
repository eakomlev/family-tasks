const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)

// Веб-просмотр (`npm run web:preview`): у SecureStore нет веб-версии, для хранения токена входа используем localStorage (см. scripts/web-shims).
// Нативные сборки (Android, iPhone) используют настоящие пакеты.
const shims = {
  'expo-secure-store': path.resolve(__dirname, 'scripts/web-shims/expo-secure-store.ts'),
}
const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && shims[moduleName]) return { type: 'sourceFile', filePath: shims[moduleName] }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
