import { hostname } from 'node:os'
import { createPool } from './db.js'
import { isAlive } from './state.js'

// Проверка контейнера: свежая ли метка живости этого экземпляра. Порт для неё не нужен.
const MAX_AGE_SECONDS = 60

const pool = createPool()
try {
  const alive = await isAlive(pool, hostname(), new Date(), MAX_AGE_SECONDS)
  process.exitCode = alive ? 0 : 1
} catch {
  process.exitCode = 1
} finally {
  await pool.end()
}
