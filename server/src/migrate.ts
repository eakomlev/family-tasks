import { fileURLToPath } from 'node:url'
import { runner } from 'node-pg-migrate'

export async function migrate(databaseUrl: string) {
  await runner({
    databaseUrl,
    dir: fileURLToPath(new URL('../migrations', import.meta.url)),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  })
}
