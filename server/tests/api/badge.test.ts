import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { unreadBadge } from '../../src/badge.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let endpoints: Record<'mom' | 'kid', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), kid: await subscribe(fam.kid.id) }
})
beforeEach(async () => {
  await resetSent()
  await pool.query('delete from messages where family_id = $1', [fam.id])
  await pool.query('delete from chat_mutes where member_id = any($1)', [[fam.mom.id, fam.kid.id]])
  await pool.query('delete from chat_archives where member_id = any($1)', [[fam.mom.id, fam.kid.id]])
  await pool.query('delete from chat_reads where member_id = any($1)', [[fam.mom.id, fam.kid.id]])
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const say = (token: string, chat: string, text: string) => api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })
const lastBadge = async (who: 'mom' | 'kid') => (await sentTo([endpoints[who]])).at(-1)?.badge

describe('число на значке', () => {
  it('считает непрочитанное во всех чатах: общем и личных, только чужие сообщения', async () => {
    await say(fam.mom.token, 'family', 'всем привет')
    await say(fam.mom.token, fam.kid.id, 'лично тебе')
    expect(await unreadBadge(pool, fam.kid.id)).toBe(2)
    expect(await unreadBadge(pool, fam.mom.id)).toBe(0)
    // свой ответ отмечает общий чат прочитанным у автора, а у мамы появляется одно непрочитанное
    await say(fam.kid.token, 'family', 'ответ')
    expect(await unreadBadge(pool, fam.kid.id)).toBe(1)
    expect(await unreadBadge(pool, fam.mom.id)).toBe(1)
  })

  it('прочитанное не считается, отключённый и архивный чат тоже', async () => {
    await say(fam.mom.token, 'family', 'раз')
    await say(fam.mom.token, fam.kid.id, 'два')
    expect(await unreadBadge(pool, fam.kid.id)).toBe(2)
    await api(app, fam.kid.token, 'PUT', '/api/chats/family/mute', { muted: true })
    expect(await unreadBadge(pool, fam.kid.id)).toBe(1)
    await api(app, fam.kid.token, 'PUT', `/api/chats/${fam.mom.id}/archive`, { archived: true })
    expect(await unreadBadge(pool, fam.kid.id)).toBe(0)
    await api(app, fam.kid.token, 'PUT', `/api/chats/${fam.mom.id}/archive`, { archived: false })
    await api(app, fam.kid.token, 'POST', `/api/chats/${fam.mom.id}/read`)
    expect(await unreadBadge(pool, fam.kid.id)).toBe(0)
  })

  it('чужая семья не влияет, неизвестный участник это 0', async () => {
    const other = await createFamily()
    try {
      await say(other.mom.token, 'family', 'у соседей')
      expect(await unreadBadge(pool, fam.kid.id)).toBe(0)
    } finally {
      await removeFamilies(other.id)
    }
    expect(await unreadBadge(pool, '11111111-1111-4111-8111-111111111111')).toBe(0)
  })

  it('push несёт число непрочитанного на момент отправки, включая это сообщение', async () => {
    await say(fam.mom.token, 'family', 'первое')
    expect(await lastBadge('kid')).toBe(1)
    await resetSent()
    await say(fam.mom.token, fam.kid.id, 'второе')
    expect(await lastBadge('kid')).toBe(2)
  })

  it('отключённый чат не копит число, но push о другом чате несёт актуальное', async () => {
    await api(app, fam.kid.token, 'PUT', '/api/chats/family/mute', { muted: true })
    await say(fam.mom.token, 'family', 'тихо')
    await say(fam.mom.token, fam.kid.id, 'громко')
    expect(await lastBadge('kid')).toBe(1)
  })
})
