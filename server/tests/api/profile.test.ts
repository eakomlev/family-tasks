import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const patch = (token: string, body: unknown) => api(app, token, 'PATCH', '/api/me', body)

describe('GET /api/me', () => {
  it('отдаёт участника с email и всех членов семьи без email', async () => {
    const { status, body } = await api(app, fam.kid.token, 'GET', '/api/me')
    expect(status).toBe(200)
    expect(body.member).toMatchObject({ id: fam.kid.id, name: 'Ребёнок', role: 'child', isOwner: false, email: fam.kid.email, avatar: null, birthDate: null })
    expect(body.members.map((m: { name: string }) => m.name)).toEqual(['Мама', 'Папа', 'Ребёнок', 'Сестра'])
    expect(JSON.stringify(body.members)).not.toContain('@')
  })
})

describe('смена имени', () => {
  it('убирает пробелы по краям и сохраняет', async () => {
    const { status, body } = await patch(fam.sis.token, { name: '  Анна  ' })
    expect(status).toBe(200)
    expect(body.member.name).toBe('Анна')
    expect((await api(app, fam.mom.token, 'GET', '/api/me')).body.members.map((m: { name: string }) => m.name)).toContain('Анна')
  })

  it('занятое имя (без учёта регистра) даёт 409', async () => {
    expect(await patch(fam.sis.token, { name: 'ПАПА' })).toMatchObject({ status: 409, body: { error: 'name_taken' } })
  })

  it('пустое и слишком длинное имя отклоняются', async () => {
    expect((await patch(fam.sis.token, { name: '   ' })).status).toBe(400)
    expect((await patch(fam.sis.token, { name: 'я'.repeat(41) })).status).toBe(400)
  })
})

describe('неизменяемые поля', () => {
  it('email и роль через PATCH не меняются: лишние поля отбрасываются и остаётся пустой патч', async () => {
    expect(await patch(fam.sis.token, { role: 'mama' })).toMatchObject({ status: 400 })
    expect(await patch(fam.sis.token, { email: 'new@test.local' })).toMatchObject({ status: 400 })
    expect(await patch(fam.sis.token, {})).toMatchObject({ status: 400 })
    const me = (await api(app, fam.sis.token, 'GET', '/api/me')).body.member
    expect(me).toMatchObject({ role: 'child', email: fam.sis.email, isOwner: false })
  })
})

describe('фото', () => {
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

  it('ставится, видно всей семье и удаляется через null', async () => {
    expect((await patch(fam.dad.token, { avatar: jpeg })).body.member.avatar).toBe(jpeg)
    const seenByMom = (await api(app, fam.mom.token, 'GET', '/api/me')).body.members.find((m: { id: string }) => m.id === fam.dad.id)
    expect(seenByMom.avatar).toBe(jpeg)
    expect((await patch(fam.dad.token, { avatar: null })).body.member.avatar).toBeNull()
  })

  it.each([
    ['чужой тип (html)', 'data:text/html;base64,PGI+'],
    ['svg', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['внешняя ссылка', 'http://evil.example/x.png'],
    ['слишком большое', `data:image/jpeg;base64,${'A'.repeat(70_001)}`],
  ])('отклоняет: %s', async (_name, avatar) => {
    expect((await patch(fam.dad.token, { avatar })).status).toBe(400)
  })
})

describe('дата рождения', () => {
  it('сохраняется строкой без сдвига дня и очищается', async () => {
    for (const date of ['2000-01-01', '1999-12-31', '2012-02-29']) {
      expect((await patch(fam.mom.token, { birthDate: date })).body.member.birthDate).toBe(date)
    }
    expect((await api(app, fam.dad.token, 'GET', '/api/me')).body.members.find((m: { id: string }) => m.id === fam.mom.id).birthDate).toBe('2012-02-29')
    expect((await patch(fam.mom.token, { birthDate: null })).body.member.birthDate).toBeNull()
  })

  it.each([
    ['из будущего', '2999-01-01'],
    ['раньше 1900', '1899-12-31'],
    ['несуществующая', '2020-02-30'],
    ['месяц 13', '2020-13-01'],
    ['не тот формат', '12.05.1985'],
    ['со временем', '1985-05-12T10:00'],
  ])('отклоняет: %s', async (_name, birthDate) => {
    expect((await patch(fam.mom.token, { birthDate })).status).toBe(400)
  })

  it('имя и дату можно менять одним запросом', async () => {
    const { body } = await patch(fam.mom.token, { name: 'Мама Лена', birthDate: '1985-05-12' })
    expect(body.member).toMatchObject({ name: 'Мама Лена', birthDate: '1985-05-12' })
  })
})
