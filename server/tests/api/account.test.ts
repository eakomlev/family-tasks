import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { directKey, eventChatKey } from '../../src/chatKey.js'
import { pool } from '../../src/db.js'
import type { MediaClient } from '../../src/media/client.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
const deleted: string[] = []

beforeAll(async () => {
  const client = { delete: async (_family: string, id: string) => void deleted.push(id) } as unknown as MediaClient
  app = await buildApp({ logger: false, rateLimit: false, media: { client, secret: 'test-secret' } })
  await app.ready()
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const message = async (chatKey: string, senderId: string, text: string) =>
  (await pool.query('insert into messages (family_id, chat_key, sender_id, text) values ($1, $2, $3, $4) returning id', [fam.id, chatKey, senderId, text])).rows[0].id as string
const media = async (uploaderId: string, messageId?: string) => {
  const id = (await pool.query(`insert into media (family_id, uploader_id, width, height, size, attached_at) values ($1, $2, 10, 10, 100, now()) returning id`, [fam.id, uploaderId])).rows[0].id as string
  if (messageId) await pool.query('insert into message_media (message_id, media_id, position) values ($1, $2, 0)', [messageId, id])
  return id
}
const count = async (sql: string, ...params: unknown[]) => Number((await pool.query(sql, params)).rows[0].count)

describe('удаление своего аккаунта', () => {
  it('ребёнку и создателю семьи нельзя, без входа 401', async () => {
    expect((await api(app, fam.kid.token, 'DELETE', '/api/me')).body.error).toBe('children_cannot_delete')
    const owner = await api(app, fam.mom.token, 'DELETE', '/api/me')
    expect(owner.status).toBe(403)
    expect(owner.body.error).toBe('owner_cannot_delete')
    expect((await api(app, null, 'DELETE', '/api/me')).status).toBe(401)
    expect(await count('select count(*) from members where id = any($1)', [fam.kid.id, fam.mom.id])).toBe(2)
  })

  it('удаляет участника со всем связанным и не трогает остальных', async () => {
    // что принадлежит папе
    const toMom = directKey(fam.dad.id, fam.mom.id)
    const momKid = directKey(fam.mom.id, fam.kid.id)
    await message(toMom, fam.dad.id, 'папа маме')
    const momReply = await message(toMom, fam.mom.id, 'мама папе')
    const fileInMomsMessage = await media(fam.mom.id, momReply)
    await message('family', fam.dad.id, 'папа всем')
    const momFamily = await message('family', fam.mom.id, 'мама всем')
    const keepFile = await media(fam.mom.id, momFamily)
    const dadOrphan = await media(fam.dad.id)
    await message(momKid, fam.mom.id, 'мама ребёнку')
    await pool.query('insert into chat_reads (member_id, chat_key, last_read_at) values ($1, $2, now()), ($3, $2, now())', [fam.mom.id, toMom, fam.dad.id])
    await pool.query('insert into chat_mutes (member_id, chat_key) values ($1, $2)', [fam.mom.id, toMom])
    // его задание ребёнку, цель создана папой остаётся у ребёнка без автора
    await pool.query(`insert into tasks (family_id, author_id, assignee_id, title) values ($1, $2, $3, 'От папы'), ($1, $4, $3, 'От мамы')`, [fam.id, fam.dad.id, fam.kid.id, fam.mom.id])
    // его событие с чатом, в котором писала мама
    const eventId = (await pool.query(`insert into events (family_id, author_id, title, start_date, end_date, all_family) values ($1, $2, 'Пикник', '2026-11-01', '2026-11-01', true) returning id`, [fam.id, fam.dad.id])).rows[0].id as string
    const eventMessage = await message(eventChatKey(eventId), fam.mom.id, 'берём плед')
    const eventFile = await media(fam.mom.id, eventMessage)
    // игра с мамой
    await pool.query(`insert into games (family_id, kind, inviter_id, invitee_id, status) values ($1, 'chess', $2, $3, 'invited')`, [fam.id, fam.dad.id, fam.mom.id])

    const res = await api(app, fam.dad.token, 'DELETE', '/api/me')
    expect(res.status).toBe(204)

    expect(await count('select count(*) from members where id = $1', fam.dad.id)).toBe(0)
    expect(await count('select count(*) from sessions where member_id = $1', fam.dad.id)).toBe(0)
    // личный чат с папой пропал целиком, включая сообщение мамы, и чат события тоже
    expect(await count('select count(*) from messages where chat_key = $1 or chat_key = $2', toMom, eventChatKey(eventId))).toBe(0)
    expect(await count('select count(*) from messages where sender_id = $1', fam.dad.id)).toBe(0)
    expect(await count('select count(*) from chat_reads where chat_key = $1', toMom)).toBe(0)
    expect(await count('select count(*) from chat_mutes where chat_key = $1', toMom)).toBe(0)
    expect(await count('select count(*) from tasks where title = $1', 'От папы')).toBe(0)
    expect(await count('select count(*) from events where id = $1', eventId)).toBe(0)
    expect(await count('select count(*) from games where inviter_id = $1 or invitee_id = $1', fam.dad.id)).toBe(0)
    // файлы: его собственный, вложения в удалённых чатах убраны из хранилища, чужой в общем чате остался
    expect(deleted.sort()).toEqual([dadOrphan, eventFile, fileInMomsMessage].sort())
    expect(await count('select count(*) from media where id = any($1)', [[dadOrphan, eventFile, fileInMomsMessage]])).toBe(0)
    expect(await count('select count(*) from media where id = $1', keepFile)).toBe(1)
    // остальное цело
    expect(await count('select count(*) from messages where id = $1', momFamily)).toBe(1)
    expect(await count('select count(*) from messages where chat_key = $1', momKid)).toBe(1)
    expect(await count('select count(*) from tasks where title = $1', 'От мамы')).toBe(1)
    expect(await count('select count(*) from members where family_id = $1', fam.id)).toBe(3)
    // сессия удалена: повторный запрос уже не пройдёт
    expect((await api(app, fam.dad.token, 'DELETE', '/api/me')).status).toBe(401)
  })
})
