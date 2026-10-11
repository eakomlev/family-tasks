import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { sendNotification, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let endpoints: Record<'mom' | 'kid' | 'sis', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), kid: await subscribe(fam.kid.id), sis: await subscribe(fam.sis.id) }
})
beforeEach(() => {
  sendNotification.mockClear()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const task = (over: object = {}) => ({
  title: 'Вынести мусор',
  assigneeId: fam.kid.id,
  date: '2026-10-12',
  time: '18:00',
  repeat: { type: 'none' },
  ...over,
})
const create = (token: string, over: object = {}) => api(app, token, 'POST', '/api/tasks', task(over))
// уведомления уходят в фоне, после ответа
const pushes = async (...who: (keyof typeof endpoints)[]) => {
  await new Promise((r) => setTimeout(r, 150))
  return sentTo(who.map((w) => endpoints[w]))
}

describe('создание', () => {
  it('создаёт задание, обрезает название, автор — тот, кто создал', async () => {
    const { status, body } = await create(fam.mom.token, { title: '  Вынести мусор  ' })
    expect(status).toBe(201)
    expect(Date.now() - new Date(body.task.createdAt).getTime()).toBeLessThan(60_000)
    expect(body.task).toMatchObject({ title: 'Вынести мусор', authorId: fam.mom.id, assigneeId: fam.kid.id, date: '2026-10-12', time: '18:00' })
  })

  it('описание необязательно, обрезается и возвращается; слишком длинное отклоняется', async () => {
    const plain = await create(fam.mom.token)
    expect(plain.body.task.description).toBe('')

    const withText = await create(fam.mom.token, { description: '  Пакеты у двери.\nНе забыть ведро.  ' })
    expect(withText.status).toBe(201)
    expect(withText.body.task.description).toBe('Пакеты у двери.\nНе забыть ведро.')

    expect((await create(fam.mom.token, { description: 'я'.repeat(1000) })).status).toBe(201)
    expect((await create(fam.mom.token, { description: 'я'.repeat(1001) })).status).toBe(400)
  })

  it('можно дать задание себе, и без срока', async () => {
    const { status, body } = await create(fam.mom.token, { assigneeId: fam.mom.id, date: null, time: null })
    expect(status).toBe(201)
    expect(body.task).toMatchObject({ date: null, time: null })
  })

  it('дни недели в недельном повторе сортируются и не дублируются', async () => {
    const { body } = await create(fam.mom.token, { repeat: { type: 'weekly', days: [3, 1, 3] } })
    expect(body.task.repeat).toEqual({ type: 'weekly', days: [1, 3], until: null })
  })

  describe('отклоняет', () => {
    it.each([
      ['пустое название', { title: '   ' }, undefined],
      ['слишком длинное название', { title: 'я'.repeat(101) }, undefined],
      ['исполнитель из другой семьи', { assigneeId: '00000000-0000-0000-0000-000000000000' }, 'assignee_not_found'],
      ['несуществующая дата', { date: '2026-02-30' }, 'invalid_date'],
      ['дата после 2100 года', { date: '2200-01-01' }, 'invalid_date'],
      ['время без даты', { date: null, time: '10:00' }, 'time_requires_date'],
      ['повтор без даты', { date: null, time: null, repeat: { type: 'daily' } }, 'repeat_requires_date'],
      ['недельный повтор без дней', { repeat: { type: 'weekly', days: [] } }, 'invalid_repeat_days'],
      ['день недели 8', { repeat: { type: 'weekly', days: [8] } }, undefined],
      ['окончание повтора раньше даты', { repeat: { type: 'daily', until: '2026-10-01' } }, 'invalid_repeat_until'],
      ['неверное время', { time: '25:00' }, undefined],
      ['неизвестный вид повтора', { repeat: { type: 'yearly' } }, undefined],
    ])('%s', async (_name, over, code) => {
      const res = await create(fam.mom.token, over)
      expect(res.status).toBe(400)
      if (code) expect(res.body.error).toBe(code)
    })

    it('исполнитель из чужой семьи', async () => {
      expect((await create(fam.mom.token, { assigneeId: outsider.mom.id })).body).toEqual({ error: 'assignee_not_found' })
    })

    it('без авторизации 401', async () => {
      expect((await api(app, null, 'POST', '/api/tasks', task())).status).toBe(401)
    })
  })
})

describe('изменение описания', () => {
  it('автор меняет описание, отметки при этом сохраняются', async () => {
    const id = (await create(fam.mom.token, { description: 'старое' })).body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    const put = await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task({ description: 'новое' }))
    expect(put.body.task.description).toBe('новое')
    const got = await api(app, fam.kid.token, 'GET', `/api/tasks/${id}`)
    expect(got.body.occurrence.done).not.toBeNull()
    // без поля описание очищается: форма всегда отправляет его целиком
    const cleared = await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task())
    expect(cleared.body.task.description).toBe('')
  })
})

describe('права на изменение и удаление', () => {
  it('менять и удалять может только автор', async () => {
    const { body } = await create(fam.mom.token)
    const id = body.task.id
    for (const other of [fam.kid, fam.sis, fam.dad]) {
      expect((await api(app, other.token, 'PUT', `/api/tasks/${id}`, task({ title: 'Чужое' }))).status).toBe(403)
      expect((await api(app, other.token, 'DELETE', `/api/tasks/${id}`)).status).toBe(403)
    }
    expect((await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task({ title: 'Моё' }))).body.task.title).toBe('Моё')
    expect((await api(app, fam.mom.token, 'DELETE', `/api/tasks/${id}`)).status).toBe(204)
    expect((await api(app, fam.mom.token, 'GET', `/api/tasks/${id}`)).status).toBe(404)
  })

  it('задание видят все в семье, но не чужая семья', async () => {
    const { body } = await create(fam.mom.token)
    expect((await api(app, fam.sis.token, 'GET', `/api/tasks/${body.task.id}`)).status).toBe(200)
    for (const call of [
      api(app, outsider.mom.token, 'GET', `/api/tasks/${body.task.id}`),
      api(app, outsider.mom.token, 'PUT', `/api/tasks/${body.task.id}`, task({ assigneeId: outsider.mom.id })),
      api(app, outsider.mom.token, 'DELETE', `/api/tasks/${body.task.id}`),
      api(app, outsider.mom.token, 'POST', `/api/tasks/${body.task.id}/complete`, { date: '2026-10-12' }),
    ]) {
      expect((await call).status).toBe(404)
    }
  })
})

describe('выполнение', () => {
  it('отметить может любой в семье, повторная отметка безвредна, снять тоже может любой', async () => {
    const { body } = await create(fam.mom.token)
    const id = body.task.id
    expect((await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })).status).toBe(204)
    expect((await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })).status).toBe(204)
    const list = await api(app, fam.sis.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-12')
    const occ = list.body.occurrences.find((o: { taskId: string }) => o.taskId === id)
    expect(occ.done).toMatchObject({ memberId: fam.kid.id })
    expect((await api(app, fam.sis.token, 'POST', `/api/tasks/${id}/uncomplete`, { date: '2026-10-12' })).status).toBe(204)
    const after = await api(app, fam.sis.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-12')
    expect(after.body.occurrences.find((o: { taskId: string }) => o.taskId === id).done).toBeNull()
  })

  it('отметить можно только реальное вхождение', async () => {
    const dated = (await create(fam.mom.token)).body.task.id
    const undated = (await create(fam.mom.token, { date: null, time: null })).body.task.id
    const weekly = (await create(fam.mom.token, { date: '2026-10-05', time: null, repeat: { type: 'weekly', days: [1] } })).body.task.id
    const attempt = (id: string, date: string | null) => api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date })
    expect((await attempt(dated, '2026-10-13')).status).toBe(400)
    expect((await attempt(dated, null)).status).toBe(400)
    expect((await attempt(undated, '2026-10-12')).status).toBe(400)
    expect((await attempt(undated, null)).status).toBe(204)
    expect((await attempt(weekly, '2026-10-13')).status).toBe(400)
    expect((await attempt(weekly, '2026-10-12')).status).toBe(204)
  })

  it('повторяющееся задание выполняется отдельно в каждый день', async () => {
    const id = (await create(fam.mom.token, { date: '2026-10-10', time: '21:00', repeat: { type: 'daily' } })).body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-13' })
    const list = await api(app, fam.kid.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-14')
    const days = list.body.occurrences.filter((o: { taskId: string }) => o.taskId === id).map((o: { date: string; done: unknown }) => [o.date, o.done !== null])
    expect(days).toEqual([['2026-10-12', false], ['2026-10-13', true], ['2026-10-14', false]])
  })
})

describe('одно задание и его вхождение', () => {
  const get = (token: string, id: string, query = '') => api(app, token, 'GET', `/api/tasks/${id}${query}`)

  it('по умолчанию первое вхождение, статус выполнения виден всем в семье', async () => {
    const id = (await create(fam.mom.token, { description: 'Подробности' })).body.task.id
    const before = await get(fam.sis.token, id)
    expect(before.body.task.description).toBe('Подробности')
    expect(before.body.occurrence).toEqual({ taskId: id, date: '2026-10-12', done: null })

    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    const after = await get(fam.sis.token, id)
    expect(after.body.occurrence.done).toMatchObject({ memberId: fam.kid.id })
  })

  it('задание без срока: вхождение с датой null', async () => {
    const id = (await create(fam.mom.token, { date: null, time: null })).body.task.id
    expect((await get(fam.kid.token, id)).body.occurrence).toEqual({ taskId: id, date: null, done: null })
  })

  it('повторяющееся: вхождение выбирается по ?date, лишнего дня нет', async () => {
    const id = (await create(fam.mom.token, { date: '2026-10-10', time: null, repeat: { type: 'daily' } })).body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-13' })
    expect((await get(fam.kid.token, id, '?date=2026-10-13')).body.occurrence.done).not.toBeNull()
    expect((await get(fam.kid.token, id, '?date=2026-10-14')).body.occurrence).toMatchObject({ date: '2026-10-14', done: null })
    expect((await get(fam.kid.token, id, '?date=2026-10-09')).body.occurrence).toBeNull()
  })

  it('неверная дата в запросе: 400, чужая семья и неизвестное задание: 404', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    expect((await get(fam.kid.token, id, '?date=вчера')).status).toBe(400)
    expect((await get(outsider.mom.token, id)).status).toBe(404)
  })
})

describe('график и отметки', () => {
  it('смена названия сохраняет отметки, смена даты сбрасывает', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    const doneState = async (from: string, to: string) =>
      (await api(app, fam.mom.token, 'GET', `/api/tasks?from=${from}&to=${to}`)).body.occurrences.filter((o: { taskId: string }) => o.taskId === id).map((o: { date: string; done: unknown }) => [o.date, o.done !== null])

    await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task({ title: 'Новое название' }))
    expect(await doneState('2026-10-12', '2026-10-12')).toEqual([['2026-10-12', true]])

    await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task({ date: '2026-10-14' }))
    expect(await doneState('2026-10-12', '2026-10-16')).toEqual([['2026-10-14', false]])
  })
})

describe('список за период', () => {
  it('содержит вхождения периода, невыполненное просроченное и задания без срока, но не выполненное просроченное', async () => {
    const own = await createFamily()
    const t = (over: object) => api(app, own.mom.token, 'POST', '/api/tasks', task({ assigneeId: own.kid.id, time: null, ...over }))
    const overdue = (await t({ title: 'Просрочено', date: '2026-10-01' })).body.task
    const overdueDone = (await t({ title: 'Просрочено и сделано', date: '2026-10-02' })).body.task
    const undated = (await t({ title: 'Без срока', date: null })).body.task
    const doneUndated = (await t({ title: 'Без срока и сделано', date: null })).body.task
    const daily = (await t({ title: 'Каждый день', date: '2026-10-10', repeat: { type: 'daily' } })).body.task
    await api(app, own.kid.token, 'POST', `/api/tasks/${overdueDone.id}/complete`, { date: '2026-10-02' })
    await api(app, own.kid.token, 'POST', `/api/tasks/${doneUndated.id}/complete`, { date: null })

    const res = await api(app, own.kid.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-13')
    const titles = new Map<string, string>(res.body.tasks.map((x: { id: string; title: string }) => [x.id, x.title]))
    const rows = res.body.occurrences.map((o: { taskId: string; date: string | null }) => [titles.get(o.taskId), o.date]).sort()
    expect(rows).toEqual([
      ['Без срока', null],
      ['Каждый день', '2026-10-12'],
      ['Каждый день', '2026-10-13'],
      ['Просрочено', '2026-10-01'],
    ])
    expect([overdue.id, undated.id, daily.id].every((id) => titles.has(id))).toBe(true)
    await removeFamilies(own.id)
  })

  it('ежемесячное в коротком месяце попадает на последний день', async () => {
    const id = (await create(fam.mom.token, { date: '2026-01-31', time: null, repeat: { type: 'monthly' } })).body.task.id
    const res = await api(app, fam.mom.token, 'GET', '/api/tasks?from=2026-02-01&to=2026-02-28')
    expect(res.body.occurrences.filter((o: { taskId: string }) => o.taskId === id).map((o: { date: string }) => o.date)).toEqual(['2026-02-28'])
  })

  it('проверяет период и работает только в пределах семьи', async () => {
    const q = (from: string, to: string) => api(app, fam.mom.token, 'GET', `/api/tasks?from=${from}&to=${to}`)
    expect((await q('2026-10-14', '2026-10-12')).status).toBe(400)
    expect((await q('2026-10-01', '2027-01-01')).status).toBe(400)
    expect((await q('2026-02-30', '2026-03-02')).status).toBe(400)
    expect((await api(app, fam.mom.token, 'GET', '/api/tasks')).status).toBe(400)
    const mine = await api(app, outsider.mom.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-14')
    expect(mine.body.tasks).toEqual([])
  })
})

describe('недавно выполненное', () => {
  it('свежее сверху, параметры проверяются', async () => {
    const own = await createFamily()
    const make = async (title: string) => (await api(app, own.mom.token, 'POST', '/api/tasks', task({ title, assigneeId: own.kid.id, date: '2026-10-12', time: null }))).body.task
    const first = await make('Первое')
    const second = await make('Второе')
    await api(app, own.kid.token, 'POST', `/api/tasks/${first.id}/complete`, { date: '2026-10-12' })
    await new Promise((r) => setTimeout(r, 20))
    await api(app, own.kid.token, 'POST', `/api/tasks/${second.id}/complete`, { date: '2026-10-12' })

    const res = await api(app, own.mom.token, 'GET', '/api/tasks/done')
    const titles = new Map<string, string>(res.body.tasks.map((x: { id: string; title: string }) => [x.id, x.title]))
    expect(res.body.occurrences.map((o: { taskId: string }) => titles.get(o.taskId))).toEqual(['Второе', 'Первое'])
    expect((await api(app, own.mom.token, 'GET', '/api/tasks/done?days=0')).status).toBe(400)
    expect((await api(app, own.mom.token, 'GET', '/api/tasks/done?days=999')).status).toBe(400)
    await removeFamilies(own.id)
  })
})

describe('удаление', () => {
  it('удаляет вместе с отметками', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    expect((await api(app, fam.mom.token, 'DELETE', `/api/tasks/${id}`)).status).toBe(204)
    const { rows } = await pool.query('select count(*)::int as n from task_completions where task_id = $1', [id])
    expect(rows[0].n).toBe(0)
  })
})

describe('уведомления', () => {
  it('исполнителю о новом задании', async () => {
    await create(fam.mom.token, { title: 'Купить хлеб' })
    const sent = await pushes('mom', 'kid', 'sis')
    expect(sent).toHaveLength(1)
    expect(sent[0].endpoint).toBe(endpoints.kid)
    expect(sent[0].payload).toMatchObject({ title: 'Новое задание', body: 'Мама: Купить хлеб · 12 октября в 18:00' })
    expect(sent[0].payload.url).toMatch(/^\/tasks\//)
  })

  it('себе ничего не отправляется', async () => {
    await create(fam.mom.token, { assigneeId: fam.mom.id })
    expect(await pushes('mom', 'kid', 'sis')).toEqual([])
  })

  it('об изменении получает исполнитель', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    await pushes('kid')
    sendNotification.mockClear()
    await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task({ title: 'Другое' }))
    const sent = await pushes('mom', 'kid', 'sis')
    expect(sent.map((s) => [s.endpoint, s.payload.title])).toEqual([[endpoints.kid, 'Задание изменено']])
  })

  it('автору о выполнении: один раз и не самому себе', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    await pushes('kid')
    sendNotification.mockClear()

    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    const sent = await pushes('mom', 'kid', 'sis')
    expect(sent.map((s) => [s.endpoint, s.payload.title, s.payload.body])).toEqual([[endpoints.mom, 'Задание выполнено', 'Ребёнок: Вынести мусор']])

    sendNotification.mockClear()
    const own = (await create(fam.mom.token, { assigneeId: fam.mom.id })).body.task.id
    await api(app, fam.mom.token, 'POST', `/api/tasks/${own}/complete`, { date: '2026-10-12' })
    expect(await pushes('mom', 'kid', 'sis')).toEqual([])
  })

  it('выполнил третий человек: уведомление автору', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    await pushes('kid')
    sendNotification.mockClear()
    await api(app, fam.sis.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    const sent = await pushes('mom', 'kid', 'sis')
    expect(sent.map((s) => [s.endpoint, s.payload.body])).toEqual([[endpoints.mom, 'Сестра: Вынести мусор']])
  })
})
