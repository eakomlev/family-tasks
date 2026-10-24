import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { extractLinks } from '../../src/chat.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  outsider = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const send = (token: string, chat: string, text: string) => api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })

describe('extractLinks', () => {
  it('достаёт ссылки без знаков препинания в конце и без повторов', () => {
    expect(extractLinks('Смотри https://example.com/a?b=1, и ещё (http://site.ru/x). Снова https://example.com/a?b=1')).toEqual([
      'https://example.com/a?b=1',
      'http://site.ru/x',
    ])
    expect(extractLinks('нет ссылок, только текст http://')).toEqual([])
  })
})

describe('поиск и ссылки в чате', () => {
  it('ищет по тексту без учёта регистра, свежие первыми, символы шаблона как обычный текст', async () => {
    await send(fam.mom.token, 'family', 'Купить Молоко и хлеб')
    await send(fam.dad.token, 'family', 'Молоко куплено 100% свежее')
    await send(fam.kid.token, 'family', 'Совсем другое')

    const found = await api(app, fam.mom.token, 'GET', `/api/chats/family/search?q=${encodeURIComponent('молоко')}`)
    expect(found.status).toBe(200)
    expect(found.body.messages.map((m: any) => m.text)).toEqual(['Молоко куплено 100% свежее', 'Купить Молоко и хлеб'])

    const percent = await api(app, fam.mom.token, 'GET', `/api/chats/family/search?q=${encodeURIComponent('100%')}`)
    expect(percent.body.messages).toHaveLength(1)
    const wildcard = await api(app, fam.mom.token, 'GET', `/api/chats/family/search?q=${encodeURIComponent('_')}`)
    expect(wildcard.body.messages).toHaveLength(0)
  })

  it('поиск постранично: before и hasMore', async () => {
    for (const n of [1, 2, 3]) await send(fam.mom.token, 'family', `страница ${n}`)
    const first = await api(app, fam.mom.token, 'GET', `/api/chats/family/search?q=${encodeURIComponent('страница')}&limit=2`)
    expect(first.body.messages).toHaveLength(2)
    expect(first.body.hasMore).toBe(true)
    const next = await api(app, fam.mom.token, 'GET', `/api/chats/family/search?q=${encodeURIComponent('страница')}&limit=2&before=${first.body.messages[1].id}`)
    expect(next.body.messages.map((m: any) => m.text)).toEqual(['страница 1'])
    expect(next.body.hasMore).toBe(false)
  })

  it('личный чат ищется только его участниками; чужой не найден', async () => {
    await send(fam.mom.token, fam.kid.id, 'секрет-слово')
    const mine = await api(app, fam.kid.token, 'GET', `/api/chats/${fam.mom.id}/search?q=${encodeURIComponent('секрет')}`)
    expect(mine.body.messages).toHaveLength(1)
    const dad = await api(app, fam.dad.token, 'GET', `/api/chats/${fam.kid.id}/search?q=${encodeURIComponent('секрет')}`)
    expect(dad.body.messages).toHaveLength(0)
    expect((await api(app, outsider.mom.token, 'GET', `/api/chats/${fam.kid.id}/search?q=x`)).status).toBe(404)
  })

  it('ссылки чата: по сообщениям, свежие первыми', async () => {
    await send(fam.mom.token, 'family', 'вот https://example.com/one и https://example.org/two.')
    await send(fam.dad.token, 'family', 'без ссылки')
    await send(fam.kid.token, 'family', 'ещё http://site.ru/three')

    const res = await api(app, fam.mom.token, 'GET', '/api/chats/family/links')
    expect(res.status).toBe(200)
    expect(res.body.items.map((i: any) => i.url)).toEqual(['http://site.ru/three', 'https://example.com/one', 'https://example.org/two'])
    expect(res.body.items[0]).toMatchObject({ senderId: fam.kid.id })
    expect(res.body.hasMore).toBe(false)
  })
})
