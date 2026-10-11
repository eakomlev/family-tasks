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
let kidEndpoint: string

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  outsider = await createFamily()
  kidEndpoint = await subscribe(fam.kid.id)
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
  time: null,
  reward: 20,
  repeat: { type: 'none' },
  ...over,
})
const create = (token: string, over: object = {}) => api(app, token, 'POST', '/api/tasks', task(over))
const complete = (token: string, id: string, date: string | null = '2026-10-12') => api(app, token, 'POST', `/api/tasks/${id}/complete`, { date })
const uncomplete = (token: string, id: string, date: string | null = '2026-10-12') => api(app, token, 'POST', `/api/tasks/${id}/uncomplete`, { date })
const confirm = (token: string, id: string, date: string | null = '2026-10-12') => api(app, token, 'POST', `/api/tasks/${id}/confirm`, { date })
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

describe('ребёнок отправляет на проверку, родитель подтверждает', () => {
  it('отметка ребёнка задания с наградой: монет нет, вхождение на проверке; подтверждение любым родителем выдаёт награду', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      expect((await complete(f.kid.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(0)

      const occ = (await api(app, f.kid.token, 'GET', `/api/tasks/${id}?date=2026-10-12`)).body.occurrence
      expect(occ.done).toBeNull()
      expect(occ.pending).toMatchObject({ memberId: f.kid.id })

      // подтверждает папа, а не автор задания (мама): подойдёт любой родитель
      expect((await confirm(f.dad.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(20)
      const after = (await api(app, f.kid.token, 'GET', `/api/tasks/${id}?date=2026-10-12`)).body.occurrence
      expect(after.pending).toBeNull()
      expect(after.done).toMatchObject({ memberId: f.kid.id })
      // награда записана от имени автора задания
      expect((await ledger(f.kid.id))[0]).toMatchObject({ amount: 20, reason: 'Задание: Вынести мусор', by: f.mom.id, taskId: id })
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('повторная отправка ребёнком ничего не меняет и не даёт монет', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await complete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await confirm(f.mom.token, id)
      await complete(f.kid.token, id)
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('родитель отмечает выполненным сразу: подтверждение не нужно, награда выдаётся', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.dad.token, id)
      expect(await balance(f.kid.token)).toBe(20)
      expect((await api(app, f.kid.token, 'GET', `/api/tasks/${id}?date=2026-10-12`)).body.occurrence.pending).toBeNull()
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('родитель «отмечает» то, что ждёт проверки: это подтверждение, награда один раз', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await complete(f.mom.token, id)
      await complete(f.dad.token, id)
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('без награды ребёнок завершает задание сам, как раньше', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 0 }))).body.task.id
      await complete(f.kid.token, id)
      const occ = (await api(app, f.kid.token, 'GET', `/api/tasks/${id}?date=2026-10-12`)).body.occurrence
      expect(occ.pending).toBeNull()
      expect(occ.done).toMatchObject({ memberId: f.kid.id })
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('подтвердить может только родитель и только то, что ждёт проверки', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      // проверять нечего
      const none = await confirm(f.mom.token, id)
      expect(none.status).toBe(400)
      expect(none.body.error).toBe('not_pending')
      await complete(f.kid.token, id)
      // ребёнок сам себя подтвердить не может
      const child = await confirm(f.kid.token, id)
      expect(child.status).toBe(403)
      expect(child.body.error).toBe('parents_only')
      expect(await balance(f.kid.token)).toBe(0)
      // уже подтверждённое повторно не подтверждается
      await confirm(f.mom.token, id)
      expect((await confirm(f.dad.token, id)).body.error).toBe('not_pending')
      expect(await balance(f.kid.token)).toBe(20)
      // неверное вхождение и чужая семья
      expect((await confirm(f.mom.token, id, '2026-10-13')).status).toBe(400)
      expect((await confirm(outsider.mom.token, id)).status).toBe(404)
      expect((await api(app, null, 'POST', `/api/tasks/${id}/confirm`, { date: '2026-10-12' })).status).toBe(401)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('отправку можно отозвать: ребёнок снимает своё, родитель возвращает на доработку; монет это не трогает', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      expect((await uncomplete(f.kid.token, id)).status).toBe(204)
      expect((await api(app, f.kid.token, 'GET', `/api/tasks/${id}?date=2026-10-12`)).body.occurrence).toMatchObject({ done: null, pending: null })

      await complete(f.kid.token, id)
      expect((await uncomplete(f.dad.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(0)
      expect(await ledger(f.kid.id)).toEqual([])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('подтверждённое с наградой ребёнок снять не может, родитель может: награда возвращается', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      await confirm(f.mom.token, id)
      const res = await uncomplete(f.kid.token, id)
      expect(res.status).toBe(403)
      expect(await balance(f.kid.token)).toBe(20)

      expect((await uncomplete(f.mom.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('ожидающее проверки не попадает в «Выполненные» и в «заработано», подтверждённое попадает', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.kid.token, id)
      const done = async () => ((await api(app, f.kid.token, 'GET', '/api/tasks/done')).body.tasks as { id: string }[]).map((t) => t.id)
      expect(await done()).not.toContain(id)
      await confirm(f.mom.token, id)
      expect(await done()).toContain(id)
    } finally {
      await removeFamilies(f.id)
    }
  })

  describe('список ожидающих проверки', () => {
    it('родитель видит все по семье, любой день; ребёнок только свои; подтверждённое уходит из списка', async () => {
      const f = await createFamily()
      try {
        const own = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, title: 'Моё' }))).body.task.id
        const sisters = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.sis.id, title: 'Сестры', date: '2026-09-01' }))).body.task.id
        await complete(f.kid.token, own)
        await complete(f.sis.token, sisters, '2026-09-01')

        const parent = (await api(app, f.mom.token, 'GET', '/api/tasks/pending')).body
        expect(parent.tasks.map((t: { title: string }) => t.title).sort()).toEqual(['Моё', 'Сестры'])
        expect(parent.occurrences.every((o: { done: unknown; pending: unknown }) => o.done === null && o.pending !== null)).toBe(true)
        expect(parent.occurrences.map((o: { date: string }) => o.date).sort()).toEqual(['2026-09-01', '2026-10-12'])

        const kid = (await api(app, f.kid.token, 'GET', '/api/tasks/pending')).body
        expect(kid.tasks.map((t: { title: string }) => t.title)).toEqual(['Моё'])

        await confirm(f.mom.token, own)
        expect((await api(app, f.mom.token, 'GET', '/api/tasks/pending')).body.tasks.map((t: { title: string }) => t.title)).toEqual(['Сестры'])
      } finally {
        await removeFamilies(f.id)
      }
    })

    it('в списке за период ожидающее видно как pending, а не done; чужая семья не видит', async () => {
      const f = await createFamily()
      try {
        const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
        await complete(f.kid.token, id)
        const { occurrences } = (await api(app, f.mom.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-12')).body
        const occ = occurrences.find((o: { taskId: string }) => o.taskId === id)
        expect(occ.done).toBeNull()
        expect(occ.pending).toMatchObject({ memberId: f.kid.id })
        expect((await api(app, outsider.mom.token, 'GET', '/api/tasks/pending')).body.tasks).toEqual([])
        expect((await api(app, null, 'GET', '/api/tasks/pending')).status).toBe(401)
      } finally {
        await removeFamilies(f.id)
      }
    })

    it('просроченное ожидающее проверки остаётся в списке за период, пока его не подтвердят', async () => {
      const f = await createFamily()
      try {
        const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, date: '2026-10-01' }))).body.task.id
        await complete(f.kid.token, id, '2026-10-01')
        const listed = async () => ((await api(app, f.mom.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-18')).body.occurrences as { taskId: string }[]).filter((o) => o.taskId === id)
        expect(await listed()).toHaveLength(1)
        await confirm(f.mom.token, id, '2026-10-01')
        // подтверждённое просроченное из «Предстоящих» уходит
        expect(await listed()).toHaveLength(0)
      } finally {
        await removeFamilies(f.id)
      }
    })
  })

  describe('уведомления', () => {
    it('отправка на проверку: push обоим родителям; ребёнку и самому себе нет', async () => {
      const f = await createFamily()
      try {
        const eps = { mom: await subscribe(f.mom.id), dad: await subscribe(f.dad.id), kid: await subscribe(f.kid.id) }
        const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, title: 'Уборка' }))).body.task.id
        sendNotification.mockClear()
        await complete(f.kid.token, id)
        await new Promise((r) => setTimeout(r, 200))
        const to = (ep: string) => sentTo([ep]).map((x) => x.payload)
        expect(to(eps.mom)).toContainEqual({ title: 'Задание на проверку', body: 'Ребёнок: Уборка', url: `/tasks/${id}`, tag: `review-${id}` })
        expect(to(eps.dad).map((x) => x.title)).toContain('Задание на проверку')
        expect(to(eps.kid).map((x) => x.title)).not.toContain('Задание на проверку')
      } finally {
        await removeFamilies(f.id)
      }
    })

    it('подтверждение: ребёнку «Награда»; автору (если подтвердил другой родитель) «Задание выполнено»', async () => {
      const f = await createFamily()
      try {
        const eps = { mom: await subscribe(f.mom.id), kid: await subscribe(f.kid.id) }
        const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, title: 'Полить' }))).body.task.id
        await complete(f.kid.token, id)
        sendNotification.mockClear()
        await confirm(f.dad.token, id)
        await new Promise((r) => setTimeout(r, 200))
        expect(sentTo([eps.kid]).map((x) => x.payload.title)).toContain('Награда')
        expect(sentTo([eps.mom]).map((x) => x.payload.title)).toContain('Задание выполнено')
      } finally {
        await removeFamilies(f.id)
      }
    })
  })
})

describe('выдача награды', () => {
  it('отметка выполнения родителем даёт исполнителю монеты от имени автора задания, запись в журнале со ссылкой на задание', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      expect((await complete(f.mom.token, id)).status).toBe(204)
      expect(await balance(f.kid.token)).toBe(20)
      expect(await ledger(f.kid.id)).toEqual([{ amount: 20, reason: 'Задание: Вынести мусор', by: f.mom.id, taskId: id }])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('повторная отметка того же вхождения награду не удваивает', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id }))).body.task.id
      await complete(f.mom.token, id)
      await complete(f.mom.token, id)
      await complete(f.dad.token, id)
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('родитель отметил: ребёнку приходит уведомление о награде', async () => {
    const id = (await create(fam.mom.token, { title: 'Уборка', reward: 30 })).body.task.id
    const before = await balance()
    sendNotification.mockClear()
    await complete(fam.dad.token, id)
    expect(await balance()).toBe(before + 30)
    await new Promise((r) => setTimeout(r, 150))
    expect(sentTo([kidEndpoint]).map((s) => s.payload)).toContainEqual({ title: 'Награда', body: '+30 монет за «Уборка»', url: '/coins', tag: `reward-${id}` })
  })

  it('без награды монеты не начисляются', async () => {
    const before = await balance()
    const id = (await create(fam.mom.token, { reward: 0 })).body.task.id
    await complete(fam.kid.token, id)
    expect(await balance()).toBe(before)
  })

  it('повторяющееся задание: награда за каждое подтверждённое выполнение отдельно', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-10', repeat: { type: 'daily' } }))).body.task.id
      for (const day of ['2026-10-10', '2026-10-11', '2026-10-12']) {
        await complete(f.kid.token, id, day)
        await confirm(f.mom.token, id, day)
      }
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
      await confirm(f.mom.token, id, null)
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
      await confirm(f.mom.token, id)
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
      expect((await complete(f.mom.token, id, '2026-10-13')).status).toBe(400)
      expect(await balance(f.kid.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('снятие отметки забирает награду ровно один раз', () => {
  // подтверждённое выполнение: ребёнок отправил, родитель подтвердил
  const approved = async (f: TestFamily, over: object = {}) => {
    const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, ...over }))).body.task.id
    await complete(f.kid.token, id)
    await confirm(f.mom.token, id)
    return id as string
  }

  it('подтвердить, снять, подтвердить, снять: баланс возвращается, никаких лишних монет', async () => {
    const f = await createFamily()
    try {
      const id = await approved(f)
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await uncomplete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await complete(f.kid.token, id)
      await confirm(f.dad.token, id)
      expect(await balance(f.kid.token)).toBe(20)
      await confirm(f.dad.token, id).catch(() => {})
      await uncomplete(f.dad.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      expect((await ledger(f.kid.id)).map((r) => r.amount)).toEqual([20, -20, 20, -20])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('отмена подписана и записана на того, кто снял отметку; снятие без выданной награды ничего не пишет', async () => {
    const f = await createFamily()
    try {
      const id = await approved(f, { title: 'Задача' })
      await uncomplete(f.dad.token, id)
      expect((await ledger(f.kid.id))[1]).toMatchObject({ amount: -20, reason: 'Отмена: Задача', by: f.dad.id })

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
      const id = await approved(f)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, reward: 50 }))
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      await complete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(50)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('смена графика сбрасывает отметки (в том числе ожидающие проверки) и забирает награды за них', async () => {
    const f = await createFamily()
    try {
      const id = (await api(app, f.mom.token, 'POST', '/api/tasks', task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-10', repeat: { type: 'daily' } }))).body.task.id
      await complete(f.kid.token, id, '2026-10-10')
      await confirm(f.mom.token, id, '2026-10-10')
      await complete(f.kid.token, id, '2026-10-11') // ждёт проверки
      expect(await balance(f.kid.token)).toBe(10)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, reward: 10, date: '2026-10-20', repeat: { type: 'daily' } }))
      expect(await balance(f.kid.token)).toBe(0)
      expect((await api(app, f.mom.token, 'GET', '/api/tasks/pending')).body.tasks).toEqual([])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('смена названия отметки и награды сохраняет', async () => {
    const f = await createFamily()
    try {
      const id = await approved(f)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.kid.id, title: 'Новое название' }))
      expect(await balance(f.kid.token)).toBe(20)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('удаление задания оставляет полученные монеты, запись теряет ссылку на задание', async () => {
    const f = await createFamily()
    try {
      const id = await approved(f)
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
      const id = await approved(f)
      await api(app, f.mom.token, 'PUT', `/api/tasks/${id}`, task({ assigneeId: f.sis.id, reward: 0 }))
      expect(await balance(f.kid.token)).toBe(20)
      await uncomplete(f.mom.token, id)
      expect(await balance(f.kid.token)).toBe(0)
      expect(await balance(f.sis.token)).toBe(0)
    } finally {
      await removeFamilies(f.id)
    }
  })
})
