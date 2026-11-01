# Моя Семья (Family Tasks)

PWA для семьи: задания, расписание уроков и тренировок детей, дни рождения, уведомления. Монорепозиторий без workspaces: у `web/`, `mobile/`, `server/`, `notifier/`, `scheduler/` и `media/` свои `package.json` и `node_modules`. Язык интерфейса и сообщений об ошибках для пользователя — русский, комментарии в коде тоже на русском.

- `web/` — React 19 + Vite 8 + TypeScript, стили на `styled-components`, PWA через `vite-plugin-pwa`, роутинг `react-router-dom`, данные на устройстве в IndexedDB (`idb-keyval`). Алиас `@/` → `web/src` (vite + `paths` в tsconfig).
- `mobile/` — будущее нативное приложение (Expo + React Native, Android и iPhone), заменит веб-версию; пока в разработке, см. `docs/mobile.md` и `docs/mobile-app-plan.md`.
- `server/` — Node 22 + Fastify 5 + `pg`, TypeScript (ESM, `NodeNext`, импорты с суффиксом `.js`).
- `notifier/` — сервис отправки писем и push из очереди `outbox` (Node 22 + `pg`, `nodemailer`, `web-push`, TypeScript как у `server/`), см. `docs/notifier.md`.
- `realtime/` — живые обновления: держит WebSocket-соединения (`/api/ws`) и рассылает клиентам сигналы из канала Postgres (Node 22 + `pg` + `ws`), см. `docs/realtime.md`.
- `scheduler/` — планировщик плановых push (дни рождения, уроки, тренировки), ставит их в `outbox` (Node 22 + `pg`), см. `docs/scheduler.md`.
- `media/` — обработка и выдача фото из чатов (Node 22 + Fastify + `sharp`), хранит файлы во внешнем S3-совместимом хранилище (рег.ру, контейнера `s3` в compose нет), см. `docs/media.md`.
- PostgreSQL 17, всё упаковано в Docker: nginx (раздаёт `web/dist`, проксирует `/api/` на `server:3000` и `/media/` на `media`) + server + notifier + scheduler + realtime + media + s3 + db. В проде перед ними Caddy с HTTPS. Письма: `nodemailer` по SMTP, в dev Mailpit (профиль compose `dev-mail`, UI на :8025).


## Куда смотреть

Подробности вынесены из этого файла в `docs/`. Перед работой над разделом откройте его файл: там правила, ловушки и устройство, которые не видны из кода.

| Файл | О чём |
|---|---|
| [docs/commands-and-tests.md](docs/commands-and-tests.md) | запуск, демо-данные, проверки типов, тесты сервера и веба, CI |
| [docs/server.md](docs/server.md) | `server/`: миграции, вход, роли, задания, чат, игры, монеты, цели, календарь, администратор, безопасность |
| [docs/web.md](docs/web.md) | `web/`: маршруты, экраны, RTK Query, нет связи, PWA, кэш, тема, структура `web/src` |
| [docs/mobile.md](docs/mobile.md) | `mobile/`: Expo, навигация, сборки APK и iOS, чат, уведомления |
| [docs/notifier.md](docs/notifier.md) | `notifier/`: очередь `outbox`, письма, push, лимиты, число на значке |
| [docs/scheduler.md](docs/scheduler.md) | `scheduler/`: плановые уведомления, удаление семей |
| [docs/media.md](docs/media.md) | `media/`: фото, файлы, видео, S3 |
| [docs/realtime.md](docs/realtime.md) | `realtime/`: WebSocket поверх Postgres |
| [docs/deploy.md](docs/deploy.md) | прод, `update.sh`, nginx, почта, VAPID, тома |
| [docs/tech-debt.md](docs/tech-debt.md) | технический долг и недоделки с приоритетами |

Планы и история решений: `docs/*-plan.md`, `docs/redux-migration.md`. Ссылки «раздел ниже» внутри этих файлов указывают на тот же файл или на соседний из таблицы.

## Основные команды

```bash
npm run setup     # один раз: зависимости и настройка
npm run dev       # БД и Mailpit в Docker, сервисы через tsx, Vite с HMR; npm run dev:stop выключает БД
npm run seed      # демо-семья (нужна БД: npm run dev:infra)
npm test          # тесты сервера и веба; test:web, test:mobile, test:notifier, test:scheduler, test:media, test:realtime
cd web && npx tsc -b && npm run lint && npm test && npm run build   # проверка веба
cd server && npm run typecheck                                        # типы сервера
./update.sh       # обновление на сервере (только по просьбе, см. docs/deploy.md)
```

Полное описание, ловушки Vitest и CI: [docs/commands-and-tests.md](docs/commands-and-tests.md).

## Соглашения

- Подтверждения только через `useConfirm()` (`components/ConfirmDialog`, провайдер в `App`): окно на всю страницу, `await confirm({ title, message, confirmLabel, danger })` → `true/false`. Системные `window.confirm/alert/prompt` не используем. В тестах компонентов с подтверждением оборачивайте их в `ConfirmProvider`.
- Действия, меняющие данные (сохранить, создать, удалить, отметить, отправить, оплатить), защищены от повторного нажатия двумя слоями: `disabled` от `busy` (для вида) и `useInFlight()` из `lib/useInFlight` (`const save = guard(async () => { … })`: пока действие не закончилось, второй вызов любого обёрнутого действия компонента игнорируется, даже если два нажатия пришли до перерисовки; у `useReview` и `usePushSubscription` то же через `useRef`). Новое такое действие оборачивайте так же и добавляйте проверку в `web/tests/components/DoubleSubmit.test.tsx` (два нажатия подряд внутри одного `act`).
- В `web/` включён `erasableSyntaxOnly`: никаких `enum` и parameter properties в конструкторах.
- API-запросы фронтенда только через `web/src/api` (общий `request`, ошибки как `ApiError` с `status` и `code`). Коды ошибок сервера — snake_case (`invite_expired`, `name_taken`), UI мапит их на тексты.
- Валидация входных данных на сервере через JSON-схемы Fastify; запросы к БД — параметризованный SQL через `pg`, без ORM. Даты и время отдаём строками через `to_char`.
- Секреты и `.env` не коммитим (`.env` и `backups/` в `.gitignore`, шаблон — `.env.example`).
- Коммиты на русском или английском без требований к формату; в `main` пушим только по просьбе пользователя.


## Как вести документацию

- Правило и устройство раздела живут в его файле в `docs/`, а не здесь: этот файл остаётся картой и общими правилами.
- Меняете поведение: правьте абзац в нужном файле `docs/`, не дописывайте дубль в другом месте.
- Технический долг: `docs/tech-debt.md`, закрыли пункт или нашли новый, обновите его.

## Известные ограничения и идеи

**Полный список технического долга и недоделок с приоритетами и размерами: `docs/tech-debt.md`** (обновляйте его, закрывая или находя пункты). Кратко о самом важном: загрузки видео и файлов читаются в память целиком, нет журнала приложения (`docs/logging-plan.md`), копии `api/` и `store/` в вебе и приложении правятся вручную, настоящая доставка push, видео, игры и число на значке на устройствах не проверялись.

- В чате есть текст, фото, видео, файлы, ответы, правка и удаление, реакции; нет пересылки сообщений, голосовых и поиска по всем чатам сразу; из других игр готовы шахматы и крестики-нолики (шашки и морской бой заглушки); страницы фронтенда целиком без автотестов (покрыта логика и ключевые компоненты).
- Во встроенной панели Browser (инструменты агента) service worker и уведомления не работают: настоящую доставку push проверять в обычном Chrome на собранной версии (README, раздел про push). На iPhone уведомления есть только у приложения, добавленного на экран «Домой» (iOS 16.4+), и нужен HTTPS.
- Название таба «Задачи» и страницы «Задания» разное, при желании унифицировать в `TABS`.
