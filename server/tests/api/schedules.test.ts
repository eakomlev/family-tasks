import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let stranger: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  stranger = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id, stranger.id)
  await app.close()
  await pool.end()
})

// Уроки и тренировки устроены одинаково: те же права, разные поля и набор дней.
const kinds = [
  {
    name: 'расписание уроков',
    path: (id: string) => `/api/members/${id}/schedule`,
    key: 'lessons',
    maxWeekday: 6,
    perDay: 12,
    item: (extra = {}) => ({ weekday: 1, subject: 'Математика', startsAt: '08:30', endsAt: '09:15', ...extra }),
    titleField: 'subject',
  },
  {
    name: 'расписание тренировок',
    path: (id: string) => `/api/members/${id}/trainings`,
    key: 'trainings',
    maxWeekday: 7,
    perDay: 8,
    item: (extra = {}) => ({ weekday: 2, title: 'Плавание', place: 'Бассейн', startsAt: '18:00', endsAt: '19:00', ...extra }),
    titleField: 'title',
  },
]

describe.each(kinds)('$name', (kind) => {
  const put = (token: string | null, memberId: string, items: unknown[]) => api(app, token, 'PUT', kind.path(memberId), { [kind.key]: items })
  const get = (token: string | null, memberId: string) => api(app, token, 'GET', kind.path(memberId))

  describe('доступ', () => {
    it('ребёнок меняет и читает своё', async () => {
      expect((await put(fam.kid.token, fam.kid.id, [kind.item()])).status).toBe(204)
      const res = await get(fam.kid.token, fam.kid.id)
      expect(res.status).toBe(200)
      expect(res.body[kind.key]).toHaveLength(1)
    })

    it('родитель (мама и папа) видит и меняет расписание ребёнка', async () => {
      for (const parent of [fam.mom, fam.dad]) {
        expect((await put(parent.token, fam.kid.id, [kind.item({ [kind.titleField]: `От ${parent.name}` })])).status).toBe(204)
        expect((await get(fam.kid.token, fam.kid.id)).body[kind.key][0][kind.titleField]).toBe(`От ${parent.name}`)
      }
    })

    it('брат или сестра не видят и не меняют (403)', async () => {
      expect((await get(fam.sis.token, fam.kid.id)).status).toBe(403)
      expect((await put(fam.sis.token, fam.kid.id, [kind.item()])).status).toBe(403)
    })

    it('чужая семья видит 404, без токена 401', async () => {
      expect((await get(stranger.mom.token, fam.kid.id)).status).toBe(404)
      expect((await put(stranger.mom.token, fam.kid.id, [])).status).toBe(404)
      expect((await get(null, fam.kid.id)).status).toBe(401)
    })

    it('у взрослых расписания нет (400), неизвестный участник 404, неверный id 400', async () => {
      expect((await get(fam.mom.token, fam.dad.id)).body).toEqual({ error: 'not_a_child' })
      expect((await get(fam.mom.token, '00000000-0000-0000-0000-000000000000')).status).toBe(404)
      expect((await get(fam.mom.token, 'not-a-uuid')).status).toBe(400)
    })
  })

  describe('сохранение', () => {
    it('заменяет список целиком и сохраняет порядок внутри дня', async () => {
      const items = ['Б', 'А', 'В'].map((t) => kind.item({ [kind.titleField]: t, startsAt: null, endsAt: null }))
      expect((await put(fam.mom.token, fam.kid.id, items)).status).toBe(204)
      expect((await get(fam.mom.token, fam.kid.id)).body[kind.key].map((x: Record<string, string>) => x[kind.titleField])).toEqual(['Б', 'А', 'В'])
      expect((await put(fam.mom.token, fam.kid.id, [kind.item()])).status).toBe(204)
      expect((await get(fam.mom.token, fam.kid.id)).body[kind.key]).toHaveLength(1)
      expect((await put(fam.mom.token, fam.kid.id, [])).status).toBe(204)
      expect((await get(fam.mom.token, fam.kid.id)).body[kind.key]).toEqual([])
    })

    it('обрезает пробелы в названии, время возвращает в формате ЧЧ:ММ', async () => {
      await put(fam.mom.token, fam.kid.id, [kind.item({ [kind.titleField]: '  Название  ' })])
      const [saved] = (await get(fam.mom.token, fam.kid.id)).body[kind.key]
      expect(saved[kind.titleField]).toBe('Название')
      expect(saved.startsAt).toMatch(/^\d{2}:\d{2}$/)
    })

    it('предметы разных дней идут по возрастанию дня', async () => {
      await put(fam.mom.token, fam.kid.id, [kind.item({ weekday: 3 }), kind.item({ weekday: 1 })])
      expect((await get(fam.mom.token, fam.kid.id)).body[kind.key].map((x: { weekday: number }) => x.weekday)).toEqual([1, 3])
    })
  })

  describe('проверка данных', () => {
    const bad = (name: string, extra: object) =>
      it(`отклоняет: ${name}`, async () => {
        expect((await put(fam.mom.token, fam.kid.id, [kind.item(extra)])).status).toBe(400)
      })

    bad('день недели 0', { weekday: 0 })
    bad(`день недели ${kind.maxWeekday + 1}`, { weekday: kind.maxWeekday + 1 })
    bad('пустое название', { [kind.titleField]: '   ' })
    bad('слишком длинное название', { [kind.titleField]: 'я'.repeat(61) })
    bad('время 25:00', { startsAt: '25:00' })
    bad('окончание раньше начала', { startsAt: '10:00', endsAt: '09:00' })
    bad('окончание равно началу', { startsAt: '10:00', endsAt: '10:00' })

    it(`принимает день ${kind.maxWeekday}, а следующий нет`, async () => {
      expect((await put(fam.mom.token, fam.kid.id, [kind.item({ weekday: kind.maxWeekday })])).status).toBe(204)
    })

    it(`не больше ${kind.perDay} в день`, async () => {
      const many = (n: number) => Array.from({ length: n }, (_, i) => kind.item({ [kind.titleField]: `П${i}`, startsAt: null, endsAt: null }))
      expect((await put(fam.mom.token, fam.kid.id, many(kind.perDay))).status).toBe(204)
      expect((await put(fam.mom.token, fam.kid.id, many(kind.perDay + 1))).body).toMatchObject({ error: expect.stringMatching(/^too_many_/) })
    })

    it('отклонённое сохранение не стирает прежнее расписание', async () => {
      await put(fam.mom.token, fam.kid.id, [kind.item({ [kind.titleField]: 'Прежнее' })])
      await put(fam.mom.token, fam.kid.id, [kind.item(), kind.item({ startsAt: '10:00', endsAt: '09:00' })])
      expect((await get(fam.mom.token, fam.kid.id)).body[kind.key][0][kind.titleField]).toBe('Прежнее')
    })
  })
})

describe('место тренировки', () => {
  it('пустое место сохраняется как «нет», пробелы обрезаются', async () => {
    const put = (items: unknown[]) => api(app, fam.mom.token, 'PUT', `/api/members/${fam.kid.id}/trainings`, { trainings: items })
    await put([
      { weekday: 1, title: 'А', place: '  Зал  ' },
      { weekday: 1, title: 'Б', place: '' },
      { weekday: 1, title: 'В' },
    ])
    const { trainings } = (await api(app, fam.mom.token, 'GET', `/api/members/${fam.kid.id}/trainings`)).body
    expect(trainings.map((t: { place: string | null }) => t.place)).toEqual(['Зал', null, null])
  })
})
