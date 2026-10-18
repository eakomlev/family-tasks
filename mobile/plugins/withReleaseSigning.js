// Плагин конфигурации Expo: подпись релизной сборки Android своим ключом и номер версии из окружения.
// Нативный проект (`android/`) создаётся командой `expo prebuild` и в репозиторий не попадает, поэтому правки build.gradle делаем здесь.
//
// Переменные окружения (задаёт workflow `.github/workflows/mobile-apk.yml`):
//   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD: свой ключ подписи;
//   ANDROID_VERSION_CODE: целое число, растёт с каждой сборкой (иначе Android не даст обновить установленное приложение).
//   ANDROID_CXX_STAGING: папка для промежуточных файлов нативной сборки (только Windows: пути к ним иначе длиннее 260 знаков,
//   и ninja падает; задайте короткую, например E:\b). На Linux (CI) не нужна.
// Без ключа сборка подписывается отладочным ключом: ставится, но обновить её поверх сборки с другим ключом нельзя.
const { withAppBuildGradle } = require('expo/config-plugins')

const RELEASE_SIGNING = `    signingConfigs {
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
`

const CXX_STAGING = `    externalNativeBuild {
        cmake {
            if (System.getenv('ANDROID_CXX_STAGING')) {
                buildStagingDirectory = file(System.getenv('ANDROID_CXX_STAGING'))
            }
        }
    }
    buildTypes {
`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents
    if (gradle.includes("System.getenv('ANDROID_KEYSTORE_PATH')")) return mod

    const next = gradle
      .replace('    signingConfigs {\n', RELEASE_SIGNING)
      .replace('    buildTypes {\n', CXX_STAGING)
      .replace(
        /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
      )
      .replace(/versionCode \d+/, "versionCode Integer.parseInt(System.getenv('ANDROID_VERSION_CODE') ?: '1')")

    if (next === gradle || !next.includes('signingConfigs.release') || !next.includes('ANDROID_VERSION_CODE') || !next.includes('ANDROID_CXX_STAGING')) {
      throw new Error('withReleaseSigning: не удалось изменить android/app/build.gradle, формат шаблона Expo изменился')
    }
    mod.modResults.contents = next
    return mod
  })
}
