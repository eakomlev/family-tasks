# Family Tasks

PWA для семейных задач: React + Vite (`web/`), Node + Fastify (`server/`), PostgreSQL. Всё упаковано в Docker.

## Запуск в Docker (как в проде)

```bash
cp .env.example .env   # поменяйте пароль
docker compose up --build
```

Приложение: http://localhost:8080. Nginx отдаёт фронтенд и проксирует `/api` на сервер.

## Локальная разработка

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
(cd server && npm install && npm run dev)   # http://localhost:3000
(cd web && npm install && npm run dev)      # http://localhost:5173, /api проксируется на :3000
```

## Миграции БД

SQL-файлы лежат в `server/migrations/` (формат `-- Up Migration` / `-- Down Migration`), используется [node-pg-migrate](https://github.com/salsita/node-pg-migrate). Сервер применяет новые миграции сам при старте. Вручную (нужен `DATABASE_URL` из `.env`):

```bash
cd server
npm run migrate:create -- add-tasks   # новый файл миграции
npm run migrate:up
npm run migrate:down                  # откат последней
```

## Как устроен вход

- Создатель семьи (мама/папа) получает код семьи, секретный токен и первое приглашение на 7 дней.
- Присоединяются по ссылке `/join?code=...` (мама/папа/ребёнок). Имена в семье уникальны.
- На устройстве в IndexedDB хранятся код семьи, роль, имя и токен. В БД лежит только SHA-256 хэш токена; токен отправляется как `Authorization: Bearer`.
