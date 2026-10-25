import { hostname } from 'node:os'
import { createPool } from './db.js'
import { isAlive } from './state.js'

// Проверка контейнера: свежая ли метка живости этого экземпляра (её ставят, только пока слушается канал).
const MAX_AGE_SECONDS = 60

const pool = createPool()
try {
  process.exitCode = (await isAlive(pool, hostname(), MAX_AGE_SECONDS)) ? 0 : 1
} catch {
  process.exitCode = 1
} finally {
  await pool.end()
}
