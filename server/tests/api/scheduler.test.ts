import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))

import { pool } from '../../src/db.js'
import { runTick } from '../../src/notifications/scheduler.js'
import { createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { sendNotification, sentTo, subscribe } from '../webpush.js'

// Вторник, 6 октября 2026. В Токио (UTC+9) 10:05 это 01:05 UTC, 17:05 это 08:05 UTC, 16:00 это 07:00 UTC.
const at = (iso: string) => new Date(`2026-10-06T${iso}:00Z`)

let fam: TestFamily
let endpoints: { mom: string; kid: string; sis: string }
const mine = () => [endpoints.mom, endpoints.kid, endpoints.sis]
const messages = (...who: (keyof typeof endpoints)[]) => sentTo(who.map((w) => endpoints[w])).map((s) => `${who.find((w) => endpoints[w] === s.endpoint)}: ${s.payload.title} | ${s.payload.body}`)

beforeAll(async () => {
  fam = await createFamily()
  // у ребёнка сегодня день рождения (ему 12), у мамы нет
  await pool.query(`update members set birth_date = '2014-10-06' where id = $1`, [fam.kid.id])
  await pool.query(`update members set birth_date = '1985-05-12' where id = $1`, [fam.mom.id])
  // уроки в среду (завтра), тренировка сегодня в 18:00 и ночная в среду в 01:30
  await pool.query(
    `insert into schedule_lessons (member_id, weekday, position, subject, starts_at, ends_at) values
       ($1, 3, 1, 'Литература', '09:25', '10:10'), ($1, 3, 2, 'Математика', '08:30', '09:15')`,
    [fam.kid.id],
  )
  await pool.query(
    `insert into training_sessions (member_id, weekday, position, title, place, starts_at) values
       ($1, 2, 1, 'Плавание', 'Бассейн', '18:00'), ($1, 3, 1, 'Зарядка', null, '01:30'), ($1, 2, 2, 'Растяжка', null, null)`,
    [fam.kid.id],
  )
  endpoints = {
    mom: await subscribe(fam.mom.id, 'Asia/Tokyo'),
    kid: await subscribe(fam.kid.id, 'Asia/Tokyo'),
    sis: await subscribe(fam.sis.id, 'America/New_York'),
  }
})
beforeEach(() => {
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 } as never)
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await pool.end()
})

describe('день рождения (10:00 по местному времени)', () => {
  it('в 10:05 по Токио: остальным «исполняется 12 лет», имениннику поздравление', async () => {
    await runTick(at('01:05'))
    expect(messages('mom', 'kid', 'sis').sort()).toEqual([
      'kid: С днём рождения, Ребёнок! 🎉 | Пусть этот день будет радостным!',
      'mom: Сегодня день рождения 🎂 | Ребёнок: исполняется 12 лет',
    ])
  })

  it('тот же проход ещё раз ничего не отправляет (журнал против дублей)', async () => {
    await runTick(at('01:05'))
    await runTick(at('01:30'))
    expect(sentTo(mine())).toEqual([])
  })

  it('в Нью-Йорке в этот момент ещё вечер предыдущего дня: уведомления нет', async () => {
    expect(sentTo([endpoints.sis])).toEqual([])
  })
})

describe('уроки (17:00 по местному времени)', () => {
  it('ребёнку на следующий день, родителю нет', async () => {
    await runTick(at('08:05'))
    expect(messages('mom', 'kid', 'sis')).toEqual(['kid: Завтра уроки | Литература, Математика · 08:30–10:10'])
  })

  it('до 17:00 и после окна (19:00) не отправляется', async () => {
    await runTick(at('07:55'))
    await runTick(at('10:05'))
    expect(messages('kid')).toEqual([])
  })
})

describe('тренировки (за 2 часа)', () => {
  it('в 16:00 по Токио напоминание о плавании в 18:00 с местом; тренировка без времени не напоминается', async () => {
    await runTick(at('07:00'))
    expect(messages('kid')).toEqual(['kid: Через 2 часа тренировка | Плавание в 18:00 · Бассейн'])
  })

  it('через 20 минут окно закрыто', async () => {
    await runTick(at('07:20'))
    expect(messages('kid')).toEqual([])
  })

  it('ночная тренировка (среда 01:30) анонсируется накануне в 23:30, один раз', async () => {
    await runTick(at('14:30'))
    await runTick(at('14:31'))
    expect(messages('kid')).toEqual(['kid: Через 2 часа тренировка | Зарядка в 01:30'])
    const { rows } = await pool.query(
      `select l.day::text from notification_log l join push_subscriptions s on s.id = l.subscription_id
       where s.endpoint = $1 and l.kind like 'training:01:30%'`,
      [endpoints.kid],
    )
    // в журнале день самой тренировки, а не день отправки
    expect(rows).toEqual([{ day: '2026-10-07' }])
  })
})

describe('устойчивость', () => {
  it('отозванная подписка (410) удаляется, остальные получают своё', async () => {
    const gone = await subscribe(fam.sis.id, 'Asia/Tokyo')
    // сестре тоже день рождения ребёнка: она в Токио и проход подходящий
    sendNotification.mockImplementation((async (sub: { endpoint: string }) => {
      if (sub.endpoint === gone) throw { statusCode: 410, message: 'gone' }
      return { statusCode: 201 }
    }) as never)
    await pool.query(`delete from notification_log where subscription_id in (select id from push_subscriptions where endpoint = $1)`, [gone])
    await runTick(at('01:06'))
    const left = await pool.query('select 1 from push_subscriptions where endpoint = $1', [gone])
    expect(left.rowCount).toBe(0)
  })

  it('неизвестный часовой пояс в подписке не роняет проход', async () => {
    await pool.query(`update push_subscriptions set time_zone = 'Mars/Base' where endpoint = $1`, [endpoints.mom])
    await expect(runTick(at('01:07'))).resolves.toBeDefined()
    await pool.query(`update push_subscriptions set time_zone = 'Asia/Tokyo' where endpoint = $1`, [endpoints.mom])
  })
})
