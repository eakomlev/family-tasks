# Family Tasks

PWA для семейных задач. Монорепозиторий без workspaces: у `web/` и `server/` свои `package.json` и `node_modules`. Язык интерфейса и сообщений об ошибках для пользователя — русский, комментарии в коде тоже на русском.

- `web/` — React 19 + Vite 8 + TypeScript, стили на `styled-components`, PWA через `vite-plugin-pwa`, роутинг `react-router-dom`, данные на устройстве в IndexedDB (`idb-keyval`). Алиас `@/` → `web/src` (vite + `paths` в tsconfig).
- `server/` — Node 22 + Fastify 5 + `pg`, TypeScript (ESM, `NodeNext`, импорты с суффиксом `.js`).
- PostgreSQL 17, всё упаковано в Docker: nginx (раздаёт `web/dist`, проксирует `/api/` на `server:3000`) + server + db. Письма: `nodemailer` по SMTP, в dev Mailpit (профиль compose `dev-mail`, UI на :8025).

## Команды

Полный стек как в проде (http://localhost:8080):

```bash
cp .env.example .env
docker compose up --build -d
docker compose down
```

Локальная разработка: БД в Docker, остальное через npm.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db mailpit
cd server && npm run dev        # :3000, перезапуск через tsx watch, читает ../.env
cd web && npm run dev           # Vite, /api проксируется на :3000
```

Проверки (тестов пока нет):

```bash
cd web && npx tsc -b && npm run lint && npm run build
cd server && npx tsc --noEmit
```

Если порт 5173 занят, Vite молча берёт следующий, смотрите адрес в выводе.

## Миграции БД

`node-pg-migrate`, SQL-файлы в `server/migrations/` с маркерами `-- Up Migration` / `-- Down Migration`. Сервер применяет их сам при старте (`server/src/migrate.ts`), поэтому в Docker отдельного шага нет. Применённые миграции не редактируем, любое изменение схемы — новый файл:

```bash
cd server && npm run migrate:create -- имя   # migrate:up / migrate:down — вручную
```

## Архитектура и важные решения

- **Вход по email + одноразовому коду** (`server/src/auth.ts`, таблица `email_codes`, purpose `signup`/`login`). Код 6 цифр, 10 минут, 5 попыток, повторная отправка раз в 60 с. Ответ на `POST /api/email-codes` одинаков для известного и неизвестного email (при `login` письмо уходит только известным; строка с кодом пишется всегда, чтобы cooldown не выдавал существование адреса). Не меняйте это поведение, не проверив, что оно не начало раскрывать email.
- **Участник** = имя + email (оба уникальны в рамках семьи, email хранится в нижнем регистре) + роль (`mama`/`papa`/`child`). Один email может быть в нескольких семьях: `POST /api/auth/login` отвечает `409 choose_member` с вариантами, код при этом не сжигается и используется повторно со `memberId`.
- **Сессии** (`sessions`): по одной на устройство, клиент хранит токен в IndexedDB, в БД SHA-256 хэш, `Authorization: Bearer`. `DELETE /api/session` отзывает только текущую.
- Создатель семьи — только мама или папа, получает `is_owner`. Присоединиться по приглашению могут все три роли.
- **Приглашения** (`invites`): многоразовые, 7 дней. Новое приглашение удаляет старые (так можно отозвать утёкшую ссылку). Ссылка вида `/join?code=...`. Владелец видит и перевыпускает его на странице семьи.
- Сервер за nginx: `trustProxy: true` для `X-Forwarded-For`. Rate limit — общий 120/мин и строгий 10/мин (`strictLimit` в `server/src/routes.ts`) на эндпоинты, где можно подбирать коды; строгий счётчик общий для этих маршрутов по IP. Сервер не должен торчать наружу в обход nginx.
- Состояние идентичности: `web/src/identity/` (провайдер читает IndexedDB, хук `useIdentity` в `context.ts`, `toIdentity` превращает ответ сервера в `Identity`). Если API отвечает 401, страница семьи очищает идентичность и возвращает на приветствие.
- Маршруты фронтенда: `/`, `/create`, `/created`, `/join`, `/login`, `/family`. nginx отдаёт `index.html` для любого пути (SPA fallback), `sw.js` и манифест не кэшируются.
- PWA: в Workbox `navigateFallbackDenylist` исключает `/api/`. Иконки генерируются из `web/public/icon.svg` командой `npm run generate-pwa-assets` (в `web/`).

## Структура `web/src`

Каждый компонент — папка с `index.tsx`. Рядом по необходимости: `styles.ts` (styled-components), `types.ts` (пропсы и типы), `utils.ts` (чистые функции). Вложенные компоненты, которые нужны только этому компоненту, лежат в его `components/` и устроены так же, на любую глубину.

- `App/`, `main.tsx` — корень, роуты.
- `pages/<Page>/` — страницы (default export), у них свои `components/`.
- `components/` — общие компоненты. Базовые примитивы (`Button`, `Input`, `Notice`, `Page`, `Stack`, `BackLink`) объявлены как styled-компоненты прямо в `index.tsx`; варианты задаются transient-пропсами (`$variant`, `$tone`), ссылки получаются через `as={Link}`.
- `GlobalStyle/` — глобальные стили. Цвета заданы CSS-переменными, тёмная тема через `prefers-color-scheme`, в styled-компонентах используйте `var(--...)`, а не жёсткие цвета.
- `api/` (`index.ts` + `types.ts`), `identity/` (провайдер, `context.ts` с хуком `useIdentity`, `utils.ts`) — не UI. Хук вынесен из `index.tsx` ради fast refresh.
- `lib/` — мелкие общие модули без UI (`roles`, `links`, `errors`, `validation`).

## Соглашения

- В `web/` включён `erasableSyntaxOnly`: никаких `enum` и parameter properties в конструкторах.
- API-запросы фронтенда только через `web/src/api` (общий `request`, ошибки как `ApiError` с `status` и `code`). Коды ошибок сервера — snake_case (`invite_expired`, `name_taken`), UI мапит их на тексты.
- Валидация входных данных на сервере через JSON-схемы Fastify; запросы к БД — параметризованный SQL через `pg`, без ORM.
- Регистрация/присоединение — общий компонент `web/src/components/RoleForm` (шаг `DetailsStep`, затем `CodeStep` с кодом). Он сам показывает ошибки; страницы только вызывают API и бросают `ApiError`.
- Секреты и `.env` не коммитим (`.env` в `.gitignore`, шаблон — `.env.example`).
- Коммиты на русском или английском без требований к формату; в `main` пушим только по просьбе пользователя.

## Деплой

Пока не определён: решено сначала сделать Docker-конфигурацию, а площадку выбрать позже. HTTPS в конфигурации нет, а он нужен для установки PWA вне localhost.
