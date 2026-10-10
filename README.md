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
