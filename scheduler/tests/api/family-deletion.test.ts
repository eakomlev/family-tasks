import { randomBytes } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAMILY_DELETION_LOCK_KEY, mediaCleanerFromEnv, runFamilyDeletions, runFamilyDeletionsAsLeader, type MediaCleaner } from '../../src/familyDeletion.js'
import { createFamily, pool, removeFamilies, type TestFamily } from '../helpers.js'

const NOW = new Date('2026-10-17T12:00:00Z')
const families: TestFamily[] = []
const silent = vi.fn()

const fakeMedia = (): MediaCleaner & { deleted: string[]; failWith: Error | null } => {
  const media = {
    deleted: [] as string[],
    failWith: null as Error | null,
    async deleteFamily(id: string) {
      if (media.failWith) throw media.failWith
      media.deleted.push(id)
    },
  }
  return media
}

// Семья с данными во всех таблицах, которые должны уйти вместе с ней
async function richFamily(): Promise<TestFamily> {
  const f = await createFamily()
  families.push(f)
  const suffix = randomBytes(4).toString('hex')
  await pool.query(`insert into tasks (family_id, author_id, assignee_id, title) values ($1, $2, $3, 'Задание')`, [f.id, f.mom.id, f.kid.id])
  await pool.query(`insert into messages (family_id, chat_key, sender_id, text) values ($1, 'family', $2, 'Привет')`, [f.id, f.mom.id])
  await pool.query(`insert into events (family_id, author_id, title, start_date, end_date) values ($1, $2, 'Событие', '2026-11-07', '2026-11-07')`, [f.id, f.mom.id])
  await pool.query(`insert into goals (family_id, member_id, title, price, created_by) values ($1, $2, 'Цель', 100, $3)`, [f.id, f.kid.id, f.mom.id])
  await pool.query(`insert into coin_transactions (member_id, amount, reason) values ($1, 50, 'тест')`, [f.kid.id])
  await pool.query(`insert into sessions (member_id, token_hash) values ($1, $2)`, [f.mom.id, `hash-${suffix}`])
  await pool.query(`insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p', 'a', 'UTC')`, [f.mom.id, `https://push.test/${suffix}`])
  await pool.query(`insert into invites (family_id, code, expires_at) values ($1, $2, now() + interval '7 days')`, [f.id, `inv-${suffix}`])
  await pool.query(`insert into media (family_id, uploader_id, width, height, size) values ($1, $2, 10, 10, 100)`, [f.id, f.mom.id])
  await pool.query(`insert into schedule_lessons (member_id, weekday, position, subject) values ($1, 1, 1, 'Математика')`, [f.kid.id])
  return f
}

const request = (f: TestFamily, over: { nextAttemptAt?: Date } = {}) =>
  pool.query(`insert into family_deletions (family_id, requested_by, next_attempt_at) values ($1, $2, $3)`, [f.id, f.mom.id, over.nextAttemptAt ?? NOW])
const count = async (table: string, where: string, value: string) => (await pool.query(`select count(*)::int as n from ${table} where ${where} = $1`, [value])).rows[0].n as number
const familyExists = async (f: TestFamily) => (await count('families', 'id', f.id)) === 1
const dataLeft = async (f: TestFamily) =>
  (await count('members', 'family_id', f.id)) + (await count('tasks', 'family_id', f.id)) + (await count('messages', 'family_id', f.id)) + (await count('events', 'family_id', f.id)) +
  (await count('goals', 'family_id', f.id)) + (await count('invites', 'family_id', f.id)) + (await count('media', 'family_id', f.id))

beforeEach(() => {
  silent.mockReset()
})
afterAll(async () => {
  await removeFamilies(...families.map((f) => f.id))
  await pool.end()
})

describe('удаление семьи по заявке', () => {
  it('сначала файлы в хранилище, потом все данные семьи; чужая семья не тронута', async () => {
    const doomed = await richFamily()
    const safe = await richFamily()
    await request(doomed)
    const media = fakeMedia()

    const result = await runFamilyDeletions(pool, media, NOW, silent)

    expect(result).toEqual({ deleted: 1, failed: 0 })
    expect(media.deleted).toEqual([doomed.id])
    expect(await familyExists(doomed)).toBe(false)
    expect(await dataLeft(doomed)).toBe(0)
    // связанное с участниками тоже ушло: сессии, подписки, монеты, расписания
    for (const table of ['sessions', 'push_subscriptions', 'coin_transactions', 'schedule_lessons']) {
      const { rows } = await pool.query(`select count(*)::int as n from ${table} t join members m on m.id = t.member_id where m.id = any($1)`, [[doomed.mom.id, doomed.kid.id]])
      expect(rows[0].n, table).toBe(0)
    }
    expect(await count('family_deletions', 'family_id', doomed.id)).toBe(0)
    // другая семья со всеми данными на месте
    expect(await familyExists(safe)).toBe(true)
    expect(await count('members', 'family_id', safe.id)).toBe(4)
    expect(await count('tasks', 'family_id', safe.id)).toBe(1)
    expect(await count('messages', 'family_id', safe.id)).toBe(1)
    expect(silent).toHaveBeenCalledWith('info', 'family_deleted', { familyId: doomed.id, members: 4 })
  })

  it('в журнал попадает только число участников, а не имена и адреса', async () => {
    const f = await richFamily()
    await request(f)
    await runFamilyDeletions(pool, fakeMedia(), NOW, silent)
    const logged = JSON.stringify(silent.mock.calls)
    expect(logged).not.toContain('@test.local')
    expect(logged).not.toContain('Мама')
  })

  it('без настроенного сервиса media семья удаляется без файлов', async () => {
    const f = await richFamily()
    await request(f)
    expect(await runFamilyDeletions(pool, null, NOW, silent)).toEqual({ deleted: 1, failed: 0 })
    expect(await familyExists(f)).toBe(false)
  })

  it('заявка, срок которой не пришёл, ждёт', async () => {
    const f = await richFamily()
    await request(f, { nextAttemptAt: new Date(NOW.getTime() + 60_000) })
    const media = fakeMedia()
    expect(await runFamilyDeletions(pool, media, NOW, silent)).toEqual({ deleted: 0, failed: 0 })
    expect(media.deleted).toEqual([])
    expect(await familyExists(f)).toBe(true)
    // через минуту срок пришёл
    expect(await runFamilyDeletions(pool, media, new Date(NOW.getTime() + 61_000), silent)).toEqual({ deleted: 1, failed: 0 })
  })

  it('сбой хранилища: семья остаётся целой, заявка повторяется позже с растущей паузой', async () => {
    const f = await richFamily()
    await request(f)
    const media = fakeMedia()
    media.failWith = new Error('media delete failed: 502')

    expect(await runFamilyDeletions(pool, media, NOW, silent)).toEqual({ deleted: 0, failed: 1 })
    expect(await familyExists(f)).toBe(true)
    expect(await dataLeft(f)).toBeGreaterThan(0)
    let [row] = (await pool.query('select attempts, last_error, next_attempt_at from family_deletions where family_id = $1', [f.id])).rows
    expect(row).toMatchObject({ attempts: 1, last_error: 'media delete failed: 502' })
    // первая пауза минута
    expect(new Date(row.next_attempt_at).getTime()).toBe(NOW.getTime() + 60_000)
    expect(silent).toHaveBeenCalledWith('error', 'family_deletion_failed', expect.objectContaining({ familyId: f.id, attempts: 1 }))

    // сразу же снова не пробуем
    expect(await runFamilyDeletions(pool, media, new Date(NOW.getTime() + 30_000), silent)).toEqual({ deleted: 0, failed: 0 })
    // вторая попытка: пауза уже две минуты
    const second = new Date(NOW.getTime() + 61_000)
    expect(await runFamilyDeletions(pool, media, second, silent)).toEqual({ deleted: 0, failed: 1 })
    ;[row] = (await pool.query('select attempts, next_attempt_at from family_deletions where family_id = $1', [f.id])).rows
    expect(row.attempts).toBe(2)
    expect(new Date(row.next_attempt_at).getTime()).toBe(second.getTime() + 120_000)

    // хранилище ожило: следующая попытка завершает удаление
    media.failWith = null
    expect(await runFamilyDeletions(pool, media, new Date(second.getTime() + 121_000), silent)).toEqual({ deleted: 1, failed: 0 })
    expect(await familyExists(f)).toBe(false)
  })

  it('сбой одной семьи не мешает остальным в том же проходе', async () => {
    const bad = await richFamily()
    const good = await richFamily()
    await request(bad)
    await request(good)
    const media = fakeMedia()
    media.deleteFamily = async (id) => {
      if (id === bad.id) throw new Error('boom')
      media.deleted.push(id)
    }
    expect(await runFamilyDeletions(pool, media, NOW, silent)).toEqual({ deleted: 1, failed: 1 })
    expect(await familyExists(bad)).toBe(true)
    expect(await familyExists(good)).toBe(false)
  })

  it('за проход не больше пяти семей', async () => {
    const batch: TestFamily[] = []
    for (let i = 0; i < 6; i++) {
      const f = await createFamily()
      families.push(f)
      batch.push(f)
      await request(f)
    }
    expect((await runFamilyDeletions(pool, fakeMedia(), NOW, silent)).deleted).toBe(5)
    expect((await runFamilyDeletions(pool, fakeMedia(), NOW, silent)).deleted).toBe(1)
  })
})

describe('лидер и настройка media', () => {
  it('пока другой экземпляр держит блокировку, этот ничего не делает', async () => {
    const f = await richFamily()
    await request(f)
    const holder = await pool.connect()
    try {
      await holder.query('select pg_advisory_lock($1)', [FAMILY_DELETION_LOCK_KEY])
      expect(await runFamilyDeletionsAsLeader(pool, fakeMedia(), NOW, silent)).toBeNull()
      expect(await familyExists(f)).toBe(true)
    } finally {
      await holder.query('select pg_advisory_unlock($1)', [FAMILY_DELETION_LOCK_KEY])
      holder.release()
    }
    expect(await runFamilyDeletionsAsLeader(pool, fakeMedia(), NOW, silent)).toEqual({ deleted: 1, failed: 0 })
    // блокировка снята: следующий вызов снова может стать лидером
    expect(await runFamilyDeletionsAsLeader(pool, fakeMedia(), NOW, silent)).toEqual({ deleted: 0, failed: 0 })
  })

  it('клиент media: без токена нет, с токеном вызывает внутренний API семьи', async () => {
    expect(mediaCleanerFromEnv({})).toBeNull()
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(null, { status: 204 })
    })
    try {
      const cleaner = mediaCleanerFromEnv({ MEDIA_INTERNAL_TOKEN: 'secret', MEDIA_URL: 'http://media.test:3000/' })!
      await cleaner.deleteFamily('fam-1')
      expect(calls[0].url).toBe('http://media.test:3000/internal/families/fam-1')
      expect(calls[0].init).toMatchObject({ method: 'DELETE', headers: { 'x-internal-token': 'secret' } })
      vi.stubGlobal('fetch', async () => new Response(null, { status: 502 }))
      await expect(cleaner.deleteFamily('fam-1')).rejects.toThrow('media delete failed: 502')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
