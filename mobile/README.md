# Моя Семья: мобильное приложение

Нативное приложение (Expo, React Native) для Android и iPhone. Описание, команды и ловушки: раздел «Мобильное приложение» в корневом `CLAUDE.md`, план работ в `docs/mobile-app-plan.md`.

```bash
npm install
EXPO_PUBLIC_API_URL=http://<IP компьютера>:8080 npx expo start
npm run typecheck && npm test
```

## Сборка APK

Каждый пуш в `main`, затрагивающий `mobile/`, запускает workflow `.github/workflows/mobile-apk.yml`: он собирает подписанный APK и кладёт его в релиз `mobile-latest`. Постоянная ссылка (открыть на телефоне и установить):

```
https://github.com/<владелец>/<репозиторий>/releases/download/mobile-latest/moya-semya.apk
```

Для приватного репозитория скачивать нужно, будучи залогиненным в GitHub. Вручную собрать можно на вкладке Actions («Run workflow»). Установка вне магазина: Android попросит разрешить установку из браузера.

### Настройка (один раз)

1. **Ключ подписи.** Нужен JDK (команда `keytool`). Создайте ключ и **сохраните файл и пароли** (потеряете — новые сборки не обновят установленное приложение, придётся удалять его и ставить заново):

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore family-tasks.jks -alias family-tasks -keyalg RSA -keysize 2048 -validity 10000
   ```

   Файл `*.jks` в репозиторий не добавляйте (он в `.gitignore`).

2. **Файл в base64.** PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("family-tasks.jks")) | Set-Clipboard
   ```

   Linux и macOS: `base64 -w0 family-tasks.jks`.

3. **Секреты** (Settings → Secrets and variables → Actions → Secrets):
   - `ANDROID_KEYSTORE_BASE64`: содержимое из шага 2;
   - `ANDROID_KEYSTORE_PASSWORD`: пароль хранилища;
   - `ANDROID_KEY_ALIAS`: `family-tasks` (имя из команды);
   - `ANDROID_KEY_PASSWORD`: пароль ключа (при `PKCS12` совпадает с паролем хранилища).

4. **Переменная** (там же, вкладка Variables): `MOBILE_API_URL`, адрес сервера, который вшивается в приложение, например `https://family.example.com` (без `/` на конце).

Без секретов подписи сборка всё равно пройдёт, но APK подписан отладочным ключом (в описании релиза это указано): поставить можно, обновить поверх сборки с другим ключом нельзя. Без переменной `MOBILE_API_URL` workflow остановится с понятной ошибкой.

### Локальная сборка на Windows

Проверить сборку без GitHub можно скриптом (нужны JDK 17 и Android SDK из Android Studio, лицензии приняты `sdkmanager --licenses`):

```powershell
powershell -ExecutionPolicy Bypass -File scriptsuild-apk-windows.ps1 -ApiUrl https://домен
```

Скрипт копирует проект в короткую папку (`E:m`), потому что иначе Windows и ninja упираются в лимит пути 260 знаков (ошибка `ninja: error: mkdir(...): No such file or directory` при сборке `react-native-reanimated` и `rngesturehandler_codegen`), ставит зависимости, делает `expo prebuild` и `gradlew assembleRelease`. APK: `E:mandroidappuildoutputsapkeleaseapp-release.apk`. Первая сборка 15–40 минут, повторные быстрее. На Linux (CI) такого лимита нет.

### Как устроено

- Нативный проект создаётся на лету (`expo prebuild`), папки `android/` в репозитории нет. Подпись и номер версии подключает плагин `plugins/withReleaseSigning.js` (через переменные окружения; номер версии растёт с каждым запуском workflow, поэтому новые сборки ставятся поверх старых).
- Собираются архитектуры `arm64-v8a` и `armeabi-v7a` (современные телефоны); эмуляторам x86 такой APK не подходит.
- Сборка идёт 10–20 минут. Новая сборка отменяет ещё идущую. Релиз пересоздаётся каждый раз, ссылка остаётся той же.
- Push-уведомления в этой сборке пока не работают (нужен Firebase, фаза 6 плана).

## Сборка для iPhone и TestFlight

Сборку запускает вручную workflow `.github/workflows/mobile-ios.yml` (Actions → «Мобильное приложение: сборка iOS и TestFlight» → Run workflow), на каждый пуш он не запускается: минуты macOS в частных репозиториях считаются с множителем 10. Он собирает приложение на macOS-раннере, подписывает его автоматически и отправляет в TestFlight. После обработки Apple (10–30 минут) сборка появится в App Store Connect → TestFlight.

### Настройка (один раз)

1. **Аккаунт Apple Developer Program** ($99 в год): https://developer.apple.com/programs/enroll. Для личного аккаунта одобрение занимает от часа до пары дней. Team ID смотрите в developer.apple.com → Membership details.
2. **Запись приложения** в https://appstoreconnect.apple.com → Apps → «+» → New App: платформа iOS, название «Моя Семья», основной язык русский, **Bundle ID `ru.familytasks.mobile`** (если его нет в списке, сначала создайте в developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → «+» → App IDs → App; capability Push Notifications включится при подписи), любой SKU. Без этой записи отправка сборки не пройдёт.
3. **Ключ App Store Connect API** (им Xcode сам выпускает сертификат и профиль и загружает сборку): App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → «+», доступ **Admin** (или App Manager). Скачайте файл `AuthKey_XXXXXXXXXX.p8` (он скачивается один раз), запишите Key ID и Issuer ID со страницы.
4. **Секреты репозитория** (Settings → Secrets and variables → Actions): `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID` и `APPSTORE_KEY_P8_BASE64` (содержимое файла `.p8` одной строкой base64: в PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8"))`). Переменная репозитория `MOBILE_API_URL` та же, что для APK.
5. **Тестировщики:** в App Store Connect → TestFlight → Internal Testing создайте группу и добавьте людей (им нужен Apple ID, приглашённый в App Store Connect → Users and Access, роль хотя бы Customer Support/Marketing) или внешнюю группу по ссылке (первую внешнюю сборку Apple проверяет вручную). Тестировщик ставит приложение TestFlight из App Store и открывает приглашение.

### Push на iPhone (APNs)

Ключ для push отдельный: developer.apple.com → Certificates, Identifiers & Profiles → Keys → «+» → **Apple Push Notifications service (APNs)** → скачайте `.p8`. В `.env` сервера задайте `APNS_ENABLED=true`, `APNS_KEY_BASE64` (файл одной строкой base64), `APNS_KEY_ID`, `APNS_TEAM_ID` (`APNS_BUNDLE_ID` по умолчанию `ru.familytasks.mobile`), перезапустите `server`, `scheduler` и `notifier` (`./update.sh`). Сборки из TestFlight и App Store используют боевой APNs (`APNS_PRODUCTION=true`). Токен регистрируется, когда человек включает уведомления в приложении.

### Как устроено

- **Нативный проект** (`ios/`, в репозитории его нет) создаёт `expo prebuild` на раннере; название приложения кириллицей, поэтому workflow сам находит `*.xcworkspace` и схему.
- **Подпись автоматическая:** `xcodebuild -allowProvisioningUpdates` с ключом App Store Connect API выпускает облачный сертификат распространения и профиль, ничего хранить не нужно. `-exportArchive` с `destination upload` сразу загружает сборку в App Store Connect.
- **Номер сборки** (`CFBundleVersion`) равен номеру запуска workflow, версия (`CFBundleShortVersionString`) берётся из `version` в `app.json`. Описание шифрования заранее задано (`usesNonExemptEncryption: false`), вопросов про экспорт в TestFlight не будет.
- **Расширение «Поделиться»** на iPhone выключено (`expo-sharing`, `ios.enabled: false`): ему нужна отдельная подпись и группа приложений. Включите после первой успешной сборки и зарегистрируйте группу `group.ru.familytasks.mobile`.
- **Prebuild iOS на Windows не работает**, проверять сборку можно только на macOS или в этом workflow.
