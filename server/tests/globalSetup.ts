import pg from 'pg'
import { migrate } from '../src/migrate.js'
import { adminDatabaseUrl, TEST_DB_NAME, testDatabaseUrl } from './testDb.js'

// Один раз перед всеми тестами: создаём тестовую БД, если её нет, и применяем миграции.
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
  await migrate(testDatabaseUrl())
  // очередь от прошлых прогонов: тесты читают её как «отправленное»
  const db = new pg.Client({ connectionString: testDatabaseUrl() })
  await db.connect()
  try {
    await db.query('delete from outbox')
  } finally {
    await db.end()
  }
}
