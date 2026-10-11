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
let kidEndpoint: string

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  kidEndpoint = await subscribe(fam.kid.id)
})
beforeEach(() => {
  sendNotification.mockClear()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const task = (over: object = {}) => ({
  title: 'Вынести мусор',
  assigneeId: fam.kid.id,
  date: '2026-10-12',
  time: null,
  reward: 20,
  repeat: { type: 'none' },
  ...over,
})
const create = (token: string, over: object = {}) => api(app, token, 'POST', '/api/tasks', task(over))
const complete = (token: string, id: string, date: string | null = '2026-10-12') => api(app, token, 'POST', `/api/tasks/${id}/complete`, { date })
const uncomplete = (token: string, id: string, date: string | null = '2026-10-12') => api(app, token, 'POST', `/api/tasks/${id}/uncomplete`, { date })
const balance = async (token = fam.kid.token) => (await api(app, token, 'GET', '/api/me')).body.member.coins as number
const ledger = async (memberId = fam.kid.id) =>
  (await pool.query('select amount, reason, created_by as "by", task_id as "taskId" from coin_transactions where member_id = $1 order by created_at, id', [memberId])).rows

describe('награда в задании', () => {
  it('сохраняется и возвращается; по умолчанию 0', async () => {
    expect((await create(fam.mom.token)).body.task.reward).toBe(20)
    expect((await create(fam.mom.token, { reward: undefined })).body.task.reward).toBe(0)
  })

  it('границы: 0 и 1000 можно, больше и отрицательные нельзя, дробные тоже', async () => {
    expect((await create(fam.mom.token, { reward: 1000 })).status).toBe(201)
    expect((await create(fam.mom.token, { reward: 0 })).status).toBe(201)
    for (const reward of [1001, -1, 2.5]) expect((await create(fam.mom.token, { reward })).status).toBe(400)
  })

  it('только за задания детей: взрослому с наградой 400, без награды можно', async () => {
    const bad = await create(fam.mom.token, { assigneeId: fam.dad.id, reward: 10 })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('reward_requires_child')
    expect((await create(fam.mom.token, { assigneeId: fam.dad.id, reward: 0 })).status).toBe(201)
  })

  it('при изменении: награду можно менять, а сменить исполнителя на взрослого с наградой нельзя', async () => {
    const id = (await create(fam.mom.token)).body.task.id
    const put = (over: object) => api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task(over))
    expect((await put({ reward: 35 })).body.task.reward).toBe(35)
    expect((await put({ assigneeId: fam.dad.id, reward: 35 })).status).toBe(400)
    expect((await put({ assigneeId: fam.dad.id, reward: 0 })).body.task.reward).toBe(0)
  })
})

describe('награду назначают только родители', () => {
  it('ребёнок не может указать награду: ни себе, ни другому ребёнку', async () => {
    for (const assigneeId of [fam.kid.id, fam.sis.id]) {
      const res = await create(fam.kid.token, { assigneeId, reward: 10 })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('reward_requires_parent')
    }
  })

  it('ребёнок создаёт задание без награды (и себе, и другим), а родитель с наградой', async () => {
    expect((await create(fam.kid.token, { assigneeId: fam.kid.id, reward: 0 })).status).toBe(201)
    expect((await create(fam.kid.token, { assigneeId: fam.sis.id, reward: undefined })).status).toBe(201)
    expect((await create(fam.dad.token, { assigneeId: fam.kid.id, reward: 10 })).status).toBe(201)
  })

  it('при изменении своего задания ребёнок тоже не может добавить награду', async () => {
    const id = (await create(fam.kid.token, { assigneeId: fam.kid.id, reward: 0 })).body.task.id
    const res = await api(app, fam.kid.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: fam.kid.id, reward: 5 }))
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('reward_requires_parent')
    // без награды изменение проходит
    expect((await api(app, fam.kid.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: fam.kid.id, reward: 0, title: 'Своё' }))).status).toBe(200)
  })

  it('чужое задание с наградой ребёнок изменить не может вообще', async () => {
    const id = (await create(fam.mom.token, { reward: 10 })).body.task.id
    expect((await api(app, fam.kid.token, 'PUT', `/api/tasks/${id}`, task({ reward: 1000 }))).status).toBe(403)
  })
})

describe('выдача награды', () => {
  it('отметка выполнения даёт исполнителю монеты от имени автора задания, запись в журнале со ссылкой на задание', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      expect((await complete(f.kid.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(20)
      const rows = await ledger(f.kid.id)
      expect(rows).toEqual([{ amount: 20, reason: 'Задание: Вынести мусор', by: f.mom.id, taskId: id }])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('повторная отметка того же вхождения награду не удваивает', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await complete(f.kid.token, id)
      await complete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('отметил родитель: награда всё равно у исполнителя, ребёнку приходит уведомление', async () => {
    const id = (await create(fam.mom.token, { title: 'Уборка', reward: 30 })).body.task.id
    const before = await balance()
    sendNotification.mockClear()
    await complete(fam.dad.token, id)
    expect(await balance()).toBe(before + 30)
    await new Promise((r) => setTimeout(r, 150))
    const kidPushes = sentTo([kidEndpoint]).map((s) => s.payload)
    expect(kidPushes).toContainEqual({ title: 'Награда', body: '+30 монет за «Уборка»', url: '/coins', tag: `reward-${id}` })
  })

  it('отметил сам ребёнок: уведомления о награде ему нет', async () => {
    const id = (await create(fam.mom.token, { title: 'Сам', reward: 5 })).body.task.id
    sendNotification.mockClear()
    await complete(fam.kid.token, id)
    await new Promise((r) => setTimeout(r, 150))
    expect(sentTo([kidEndpoint]).map((s) => s.payload.title)).not.toContain('Награда')
  })

  it('без награды монеты не начисляются', async () => {
    const before = await balance()
    const id = (await create(fam.mom.token, { reward: 0 })).body.task.id
    await complete(fam.kid.token, id)
    expect(await balance()).toBe(before)
  })

  it('повторяющееся задание: награда за каждое выполнение отдельно', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-10', repeat: { type: 'daily' } }))).body.task.id
      await complete(f.kid.token, id, '2026-10-10')
      await complete(f.kid.token, id, '2026-10-11')
      await complete(f.kid.token, id, '2026-10-12')
      expect(await balance(f.kid.token)).toBe(30)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('задание без срока тоже награждается', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, date: null }))).body.task.id
      await complete(f.kid.token, id, null)
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('история монет показывает награду: за что, кто и сколько', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, title: 'Полить цветы', reward: 15 }))).body.task.id
      await complete(f.kid.token, id)
      const { body } = await api(app, f.kid.token, 'GET', '/api/coins')
      expect(body.items[0]).toMatchObject({ amount: 15, reason: 'Задание: Полить цветы', createdBy: f.mom.id })
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('невозможное вхождение награды не даёт', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      expect((await complete(f.kid.token, id, '2026-10-13')).status).toBe(400)
      expect(await balance(f.kid.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('снятие отметки забирает награду ровно один раз', () => {
  it('отметить, снять, отметить, снять: баланс возвращается, никаких лишних монет', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await uncomplete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await complete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(20)
      await complete(f.kid.token, id)
      await uncomplete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      // каждая запись журнала понятна: выдача, отмена, выдача, отмена
      expect((await ledger(f.kid.id)).map((r) => r.amount)).toEqual([20, -20, 20, -20])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('отмена подписана и записана на того, кто снял отметку; снятие без выданной награды ничего не пишет', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, title: 'Задача' }))).body.task.id
      await complete(f.kid.token, id)
      await uncomplete(f.mom.token, id)
      const rows = await ledger(f.kid.id)
      expect(rows[1]).toMatchObject({ amount: -20, reason: 'Отмена: Задача', by: f.mom.id })

      const free = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 0 }))).body.task.id
      await complete(f.kid.token, free)
      await uncomplete(f.kid.token, free)
      expect(await ledger(f.kid.id)).toHaveLength(2)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('смена награды после выполнения не меняет уже выданное: отмена забирает ровно столько, сколько выдали', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 20 }))).body.task.id
      await complete(f.kid.token, id)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, reward: 50 }))
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await complete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(50)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('смена графика сбрасывает отметки и забирает награды за них', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-10', repeat: { type: 'daily' } }))).body.task.id
      await complete(f.kid.token, id, '2026-10-10')
      await complete(f.kid.token, id, '2026-10-11')
      expect(await balance(f.kid.token)).toBe(20)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-20', repeat: { type: 'daily' } }))
      expect(await balance(f.kid.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('смена названия отметки и награды сохраняет', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, title: 'Новое название' }))
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('удаление задания оставляет полученные монеты, запись теряет ссылку на задание', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await api(app, f.mom.token, 'DELETE', `/api/tasks/${id}`)
      expect(await balance(f.kid.token)).toBe(20)
      expect((await ledger(f.kid.id))[0].taskId).toBeNull()
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('если исполнителя сменили, отмена забирает монеты у того, кто их получил', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.mom.token, id)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.sis.id }))
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      expect(await balance(f.sis.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })
})
