import { loadEnv } from 'vite'

export const TEST_DB_NAME = 'family_tasks_test'
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'db']

// Адрес тестовой БД: тот же сервер Postgres, что в .env (или в переменной DATABASE_URL), но своя база.
// Тесты создают и удаляют данные, поэтому на нелокальный сервер они не пойдут.
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? loadEnv('test', '..', '').DATABASE_URL
  if (!base) throw new Error('Не задан DATABASE_URL: нужен .env в корне проекта (см. .env.example) и запущенная БД (npm run dev:infra).')
  const url = new URL(base)
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`БД на хосте «${url.hostname}» не локальная, тесты на ней не запускаю.`)
  }
  url.pathname = `/${TEST_DB_NAME}`
  return url.toString()
}

// Адрес служебной базы postgres, через неё создаём тестовую.
export function adminDatabaseUrl(): string {
  const url = new URL(testDatabaseUrl())
  url.pathname = '/postgres'
  return url.toString()
}
