import { hostname } from 'node:os'
import { startRealtime } from './app.js'
import { createPool } from './db.js'
import { log } from './log.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const port = Number(process.env.PORT) || 3000
const instance = hostname()
const pool = createPool()

const realtime = await startRealtime({ pool, connectionString: databaseUrl, log, port, instance })
log('info', 'realtime_started', { instance, port: realtime.port })

let stopping = false
const stop = async () => {
  if (stopping) return
  stopping = true
  await realtime.close()
  await pool.end()
  log('info', 'realtime_stopped', { instance })
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void stop())
