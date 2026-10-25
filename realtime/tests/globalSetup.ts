import { fileURLToPath } from 'node:url'
import { runner } from 'node-pg-migrate'
import pg from 'pg'
import { adminDatabaseUrl, TEST_DB_NAME, testDatabaseUrl } from './testDb.js'

// Один раз перед тестами: создаём тестовую БД и применяем миграции server (схема принадлежит им).
export default async function setup() {
  const admin = new pg.Client({ connectionString: adminDatabaseUrl() })
  try {
    await admin.connect()
  } catch {
    throw new Error('Не удалось подключиться к Postgres. Запустите БД: npm run dev:infra')
  }
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [TEST_DB_NAME])
    if (!rowCount) await admin.query(`create database ${TEST_DB_NAME}`)
  } finally {
    await admin.end()
  }
  await runner({
    databaseUrl: testDatabaseUrl(),
    dir: fileURLToPath(new URL('../../server/migrations', import.meta.url)),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  })
}
