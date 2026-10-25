import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// Тело запроса больше допустимого
export class TooLarge extends Error {
  constructor() {
    super('body too large')
    this.name = 'TooLarge'
  }
}

export interface Spooled {
  path: string
  size: number
  // удаляет временный файл (вызывать всегда, в finally)
  cleanup(): Promise<void>
}

// Принимает тело запроса потоком и складывает во временный файл на диске: память остаётся плоской даже для файла в сотни мегабайт
// (раньше тело целиком лежало в буфере). Больше `limit` байт: лишнее отбрасывается, тело дочитывается до конца (разрывать соединение
// нельзя, иначе клиент не получит ответ 413), потом бросается TooLarge и файла не остаётся.
export async function spool(body: Readable, limit: number): Promise<Spooled> {
  const dir = await mkdtemp(join(tmpdir(), 'upload-'))
  const path = join(dir, 'body')
  const cleanup = () => rm(dir, { recursive: true, force: true })
  let total = 0
  const counter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      total += chunk.length
      // сверх предела на диск больше не пишем
      done(null, total > limit ? undefined : chunk)
    },
  })
  try {
    await pipeline(body, counter, createWriteStream(path))
    if (total > limit) throw new TooLarge()
    return { path, size: (await stat(path)).size, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}
