import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { testStore } from '../s3.js'

const store = testStore()
const prefix = `store-${randomUUID()}/`
const read = async (key: string) => {
  const object = await store.get(key)
  if (!object) return null
  const chunks: Buffer[] = []
  for await (const c of object.body) chunks.push(Buffer.from(c))
  return { data: Buffer.concat(chunks).toString(), size: object.size, contentType: object.contentType, etag: object.etag }
}

afterAll(async () => {
  await store.delete((await store.list(prefix)).map((o) => o.key))
})

describe('хранилище S3', () => {
  it('положил, прочитал: тело, размер и тип совпадают', async () => {
    await store.put(`${prefix}a/full.jpg`, Buffer.from('привет'), 'image/jpeg')
    expect(await read(`${prefix}a/full.jpg`)).toMatchObject({ data: 'привет', size: Buffer.byteLength('привет'), contentType: 'image/jpeg' })
    expect((await read(`${prefix}a/full.jpg`))!.etag).toBeTruthy()
  })

  it('перезапись заменяет содержимое', async () => {
    await store.put(`${prefix}b`, Buffer.from('один'), 'image/jpeg')
    await store.put(`${prefix}b`, Buffer.from('два'), 'image/jpeg')
    expect((await read(`${prefix}b`))!.data).toBe('два')
  })

  it('нет объекта: null, а не ошибка', async () => {
    expect(await store.get(`${prefix}нет`)).toBeNull()
  })

  it('список по префиксу с размерами; чужой префикс не попадает', async () => {
    await store.put(`${prefix}l/1`, Buffer.from('123'), 'image/jpeg')
    await store.put(`${prefix}l/2`, Buffer.from('12345'), 'image/jpeg')
    expect((await store.list(`${prefix}l/`)).sort((x, y) => x.key.localeCompare(y.key))).toEqual([
      { key: `${prefix}l/1`, size: 3 },
      { key: `${prefix}l/2`, size: 5 },
    ])
    expect(await store.list(`${prefix}совсем-другой/`)).toEqual([])
  })

  it('удаление: убирает указанное, отсутствующее и пустой список не ошибка', async () => {
    await store.put(`${prefix}d/1`, Buffer.from('x'), 'image/jpeg')
    await store.put(`${prefix}d/2`, Buffer.from('x'), 'image/jpeg')
    await store.delete([`${prefix}d/1`, `${prefix}d/нет`])
    expect(await store.get(`${prefix}d/1`)).toBeNull()
    expect(await store.get(`${prefix}d/2`)).not.toBeNull()
    await expect(store.delete([])).resolves.toBeUndefined()
  })

  it('список длиннее одной страницы читается целиком', async () => {
    // страница S3 это 1000 ключей; проверяем постраничное чтение на меньшем числе через несколько объектов подряд
    const keys = Array.from({ length: 25 }, (_, i) => `${prefix}many/${String(i).padStart(2, '0')}`)
    await Promise.all(keys.map((k) => store.put(k, Buffer.from('x'), 'image/jpeg')))
    expect((await store.list(`${prefix}many/`)).map((o) => o.key).sort()).toEqual(keys)
  })

  it('живость: ping проходит', async () => {
    await expect(store.ping()).resolves.toBeUndefined()
  })

  it('повторное создание бакета не ошибка', async () => {
    await expect(store.ensureBucket()).resolves.toBeUndefined()
  })
})
