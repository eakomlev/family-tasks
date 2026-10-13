import pg from 'pg'

export type Db = pg.Pool | pg.PoolClient

export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new pg.Pool({ connectionString })
}
