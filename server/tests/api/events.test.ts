import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
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

const body = (over: object = {}) => ({
  title: 'Поход в театр',
  startDate: '2026-11-07',
  endDate: '2026-11-07',
  startTime: '18:00',
  endTime: '20:30',
  allFamily: true,
  ...over,
})
const create = (token: string, over: object = {}) => api(app, token, 'POST', '/api/events', body(over))
const list = (token: string, from = '2026-11-01', to = '2026-11-30') => api(app, token, 'GET', `/api/events?from=${from}&to=${to}`)
const titles = async (token: string, from?: string, to?: string) => (await list(token, from, to)).body.events.map((e: { title: string }) => e.title)

describe('создание', () => {
  it('сохраняет событие со временем и отдаёт его целиком', async () => {
    const res = await create(fam.mom.token, { title: '  Театр  ' })
    expect(res.status).toBe(201)
    expect(res.body.event).toMatchObject({
      title: 'Театр',
      startDate: '2026-11-07',
      endDate: '2026-11-07',
      startTime: '18:00',
      endTime: '20:30',
      allFamily: true,
      memberIds: [],
      authorId: fam.mom.id,
    })
    expect(res.body.event.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('событие на весь день и на несколько дней без времени', async () => {
    const res = await create(fam.mom.token, { title: 'Отпуск', startDate: '2026-11-10', endDate: '2026-11-14', startTime: null, endTime: null })
    expect(res.status).toBe(201)
    expect(res.body.event).toMatchObject({ startTime: null, endTime: null, endDate: '2026-11-14' })
  })

  it('многодневное событие может заканчиваться «раньше» по часам', async () => {
    const res = await create(fam.mom.token, { title: 'Ночёвка', startDate: '2026-11-20', endDate: '2026-11-21', startTime: '20:00', endTime: '09:00' })
    expect(res.status).toBe(201)
  })

  it('неверные данные: конец раньше начала, время только у одного края, конец не позже начала в один день, неверная дата', async () => {
    const bad = async (over: object, error: string) => {
      const res = await create(fam.mom.token, over)
      expect(res.status, JSON.stringify(over)).toBe(400)
      expect(res.body.error).toBe(error)
    }
    await bad({ endDate: '2026-11-06' }, 'invalid_range')
    await bad({ endTime: null }, 'invalid_time')
    await bad({ startTime: null }, 'invalid_time')
    await bad({ startTime: '18:00', endTime: '18:00' }, 'invalid_time')
    await bad({ startTime: '19:00', endTime: '18:00' }, 'invalid_time')
    await bad({ startDate: '2026-02-30', endDate: '2026-03-01' }, 'invalid_date')
    await bad({ startDate: '1999-12-31', endDate: '2000-01-02' }, 'invalid_date')
    expect((await create(fam.mom.token, { title: '   ' })).status).toBe(400)
    expect((await create(fam.mom.token, { startTime: '25:00' })).status).toBe(400)
    expect((await create(fam.mom.token, { title: 'я'.repeat(101) })).status).toBe(400)
  })

  it('участники должны быть из этой семьи', async () => {
    const res = await create(fam.mom.token, { allFamily: false, memberIds: [outsider.mom.id] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_members')
  })

  it('без входа 401', async () => {
    expect((await api(app, null, 'POST', '/api/events', body())).status).toBe(401)
    expect((await api(app, null, 'GET', '/api/events?from=2026-11-01&to=2026-11-30')).status).toBe(401)
  })
})

describe('видимость', () => {
  it('вся семья видит событие «для всех», чужая семья нет', async () => {
    await create(fam.mom.token, { title: 'Общее', allFamily: true })
    for (const who of [fam.mom, fam.dad, fam.kid, fam.sis]) expect(await titles(who.token)).toContain('Общее')
    expect(await titles(outsider.mom.token)).not.toContain('Общее')
  })

  it('событие для части семьи видят автор и участники, остальные нет', async () => {
    const res = await create(fam.mom.token, { title: 'Только для детей', allFamily: false, memberIds: [fam.kid.id, fam.sis.id] })
    expect(res.body.event).toMatchObject({ allFamily: false, memberIds: [fam.kid.id, fam.sis.id].sort() })
    expect(await titles(fam.mom.token)).toContain('Только для детей')
    expect(await titles(fam.kid.token)).toContain('Только для детей')
    expect(await titles(fam.sis.token)).toContain('Только для детей')
    // папа не участник: родитель тоже не видит чужое событие
    expect(await titles(fam.dad.token)).not.toContain('Только для детей')
    expect((await api(app, fam.dad.token, 'GET', `/api/events/${res.body.event.id}`)).status).toBe(404)
    expect((await api(app, fam.kid.token, 'GET', `/api/events/${res.body.event.id}`)).status).toBe(200)
  })

  it('личное событие (без участников): видит только автор', async () => {
    await create(fam.kid.token, { title: 'Личное', allFamily: false, memberIds: [] })
    expect(await titles(fam.kid.token)).toContain('Личное')
    for (const who of [fam.mom, fam.dad, fam.sis]) expect(await titles(who.token)).not.toContain('Личное')
  })
})

describe('список периода', () => {
  it('отдаёт события, пересекающие период, по порядку; многодневное видно в каждом периоде', async () => {
    const f = await createFamily()
    try {
      await create(f.mom.token, { title: 'Раньше', startDate: '2026-10-01', endDate: '2026-10-02' })
      await create(f.mom.token, { title: 'Начало месяца с ночи', startDate: '2026-10-31', endDate: '2026-11-02', startTime: null, endTime: null })
      await create(f.mom.token, { title: 'Вечером', startDate: '2026-11-05', endDate: '2026-11-05', startTime: '19:00', endTime: '20:00' })
      await create(f.mom.token, { title: 'Утром', startDate: '2026-11-05', endDate: '2026-11-05', startTime: '08:00', endTime: '09:00' })
      await create(f.mom.token, { title: 'Целый день', startDate: '2026-11-05', endDate: '2026-11-05', startTime: null, endTime: null })
      await create(f.mom.token, { title: 'Позже', startDate: '2026-12-01', endDate: '2026-12-01' })
      expect(await titles(f.mom.token, '2026-11-01', '2026-11-30')).toEqual(['Начало месяца с ночи', 'Целый день', 'Утром', 'Вечером'])
      expect(await titles(f.mom.token, '2026-10-31', '2026-10-31')).toEqual(['Начало месяца с ночи'])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('неверный период и слишком длинный', async () => {
    expect((await list(fam.mom.token, '2026-11-10', '2026-11-01')).status).toBe(400)
    expect((await list(fam.mom.token, '2026-02-30', '2026-03-05')).status).toBe(400)
    expect((await list(fam.mom.token, '2026-01-01', '2026-12-31')).body.error).toBe('range_too_long')
    expect((await api(app, fam.mom.token, 'GET', '/api/events')).status).toBe(400)
  })
})

describe('изменение и удаление', () => {
  it('меняет и удаляет только автор; участник и другие получают 403/404', async () => {
    const created = await create(fam.mom.token, { title: 'Для правки', allFamily: false, memberIds: [fam.kid.id] })
    const id = created.body.event.id
    const edit = (token: string, over: object) => api(app, token, 'PUT', `/api/events/${id}`, body({ title: 'Исправлено', ...over }))

    expect((await edit(fam.kid.token, { allFamily: false, memberIds: [fam.kid.id] })).status).toBe(403)
    expect((await edit(fam.dad.token, {})).status).toBe(404)
    expect((await api(app, fam.kid.token, 'DELETE', `/api/events/${id}`)).status).toBe(403)

    const ok = await edit(fam.mom.token, { allFamily: false, memberIds: [fam.sis.id], startTime: null, endTime: null })
    expect(ok.status).toBe(200)
    expect(ok.body.event).toMatchObject({ title: 'Исправлено', memberIds: [fam.sis.id], startTime: null })
    // участники заменены: брат больше не видит, сестра видит
    expect(await titles(fam.kid.token)).not.toContain('Исправлено')
    expect(await titles(fam.sis.token)).toContain('Исправлено')

    // «вся семья» очищает список участников
    const all = await edit(fam.mom.token, { allFamily: true, memberIds: [fam.sis.id] })
    expect(all.body.event).toMatchObject({ allFamily: true, memberIds: [] })
    expect((await pool.query('select 1 from event_members where event_id = $1', [id])).rowCount).toBe(0)

    expect((await api(app, fam.mom.token, 'DELETE', `/api/events/${id}`)).status).toBe(204)
    expect((await api(app, fam.mom.token, 'GET', `/api/events/${id}`)).status).toBe(404)
    expect((await api(app, fam.mom.token, 'DELETE', `/api/events/${id}`)).status).toBe(404)
  })

  it('правка с неверными данными ничего не меняет', async () => {
    const created = await create(fam.mom.token, { title: 'Не трогать' })
    const id = created.body.event.id
    const res = await api(app, fam.mom.token, 'PUT', `/api/events/${id}`, body({ title: 'Сломано', endDate: '2026-01-01' }))
    expect(res.status).toBe(400)
    expect((await api(app, fam.mom.token, 'GET', `/api/events/${id}`)).body.event.title).toBe('Не трогать')
  })

  it('удаление участника из семьи убирает его из события', async () => {
    const f = await createFamily()
    try {
      const res = await create(f.mom.token, { allFamily: false, memberIds: [f.kid.id, f.sis.id] })
      await pool.query('delete from members where id = $1', [f.sis.id])
      const event = (await api(app, f.mom.token, 'GET', `/api/events/${res.body.event.id}`)).body.event
      expect(event.memberIds).toEqual([f.kid.id])
    } finally {
      await removeFamilies(f.id)
    }
  })
})
