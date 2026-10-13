import { createS3Store } from '../src/store.js'
import { testS3 } from './s3.js'

// Один раз перед тестами: хранилище должно отвечать, бакет создаём. SeaweedFS после запуска или перезапуска «просыпается» до
// полуминуты, поэтому ждём с повторами.
export default async function setup() {
  const store = createS3Store(testS3())
  let last: unknown
  for (let i = 0; i < 40; i++) {
    try {
      await store.ensureBucket()
      await store.ping()
      return
    } catch (err) {
      last = err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(`S3-хранилище не отвечает (${testS3().endpoint}). Запустите его: npm run dev:infra. ${(last as Error)?.message ?? ''}`)
}
