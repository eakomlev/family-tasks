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
