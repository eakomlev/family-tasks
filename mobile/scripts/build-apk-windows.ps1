# Локальная сборка APK на Windows (проверка того, что делает workflow .github/workflows/mobile-apk.yml).
#
# Зачем отдельный скрипт: на Windows путь к промежуточным файлам нативной сборки (ninja) не должен быть длиннее 260 знаков, а у проекта
# в E:\projects\family-tasks\mobile он длиннее. Поэтому скрипт копирует проект в короткую папку, ставит там зависимости и собирает
# с короткой папкой для нативных файлов (ANDROID_CXX_STAGING, его подхватывает plugins/withReleaseSigning.js).
#
# Нужны JDK 17 и Android SDK (платформа, Build-Tools, NDK и CMake Gradle докачает сам, если приняты лицензии).
# Запуск:  powershell -ExecutionPolicy Bypass -File scripts\build-apk-windows.ps1 [-ApiUrl https://...] [-Work E:\fm]
# Ключ подписи (необязательно, иначе отладочный): задайте ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$Work = "E:\fm",
  [string]$Staging = "E:\b",
  [string]$Arch = "arm64-v8a"
)

$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $PSScriptRoot

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not $env:JAVA_HOME) {
  $jdk = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if (-not $env:JAVA_HOME) { throw "Не найден JDK 17: задайте JAVA_HOME" }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Не найден Android SDK: задайте ANDROID_HOME" }
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Write-Host "Копирую проект в $Work"
robocopy $source $Work /E /XD node_modules android .expo /NFL /NDL /NJH /NJS /NP | Out-Null

Push-Location $Work
try {
  if (-not (Test-Path "$Work\node_modules")) {
    Write-Host "Ставлю зависимости (npm ci)"
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci завершился с ошибкой" }
  }

  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  if (-not $env:ANDROID_VERSION_CODE) { $env:ANDROID_VERSION_CODE = "1" }
  $env:ANDROID_CXX_STAGING = $Staging

  Write-Host "Создаю нативный проект (expo prebuild)"
  npx expo prebuild --platform android --no-install --clean
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild завершился с ошибкой" }

  Write-Host "Собираю APK (первый раз 15-40 минут)"
  Push-Location "$Work\android"
  try {
    .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Arch" --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Сборка Gradle завершилась с ошибкой" }
  } finally {
    Pop-Location
  }

  $apk = "$Work\android\app\build\outputs\apk\release\app-release.apk"
  Write-Host "Готово: $apk"
} finally {
  Pop-Location
}
