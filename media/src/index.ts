import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createS3Store } from './store.js'
import { createFfmpegProcessor } from './video.js'

const config = loadConfig()
const store = createS3Store(config.s3)
const app = buildApp({ config, store, video: createFfmpegProcessor({ maxSeconds: config.maxVideoSeconds }) })

// Хранилище после запуска контейнера отвечает не сразу (SeaweedFS после перезапуска до полуминуты), поэтому бакет создаём с повторами.
async function prepareBucket() {
  for (let attempt = 1; ; attempt++) {
    try {
      await store.ensureBucket()
      return
    } catch (err) {
      app.log.warn({ attempt, error: (err as Error).message }, 'storage not ready, retrying')
      if (attempt >= 60) throw err
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

await app.listen({ port: config.port, host: '0.0.0.0' })
await prepareBucket()
app.log.info({ bucket: config.s3.bucket }, 'media service ready')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
