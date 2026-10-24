import { beforeEach, describe, expect, it } from 'vitest'
import type { FamilyEvent, Member, TaskList } from '@/api'
import {
  birthdayItems,
  compareItems,
  endOfMonth,
  endOfWeek,
  eventItems,
  formatPeriod,
  groupByDay,
  holidayItems,
  isAllDay,
  placeTimed,
  rangeFor,
  shiftAnchor,
  startOfMonth,
  startOfWeek,
  taskItems,
  timeLabel,
  trainingItems,
  visibleItems,
  type CalendarItem,
} from '@/lib/calendar'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/calendarSettings'
import { holidayOn } from '@/lib/holidays'
import { task } from '../helpers'

const event = (over: Partial<FamilyEvent> = {}): FamilyEvent => ({
  id: 'e1',
  title: 'Театр',
  startDate: '2026-11-07',
  endDate: '2026-11-07',
  startTime: '18:00',
  endTime: '20:30',
  allFamily: true,
  memberIds: [],
  authorId: 'mama',
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
})
const member = (id: string, birthDate: string | null, role: Member['role'] = 'child'): Member => ({ id, name: id, role, avatar: null, isOwner: false, birthDate })

describe('периоды', () => {
  it('неделя с понедельника по воскресенье, месяц', () => {
    // 7 ноября 2026 — суббота
    expect(startOfWeek('2026-11-07')).toBe('2026-11-02')
    expect(endOfWeek('2026-11-07')).toBe('2026-11-08')
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02')
    expect(endOfWeek('2026-11-08')).toBe('2026-11-08')
    expect(startOfMonth('2026-11-17')).toBe('2026-11-01')
    expect(endOfMonth('2026-11-17')).toBe('2026-11-30')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('период данных: день, неделя, месяц целыми неделями', () => {
    expect(rangeFor('day', '2026-11-07')).toEqual({ from: '2026-11-07', to: '2026-11-07' })
    expect(rangeFor('week', '2026-11-07')).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    // 1 ноября 2026 — воскресенье, 30 ноября — понедельник
    expect(rangeFor('month', '2026-11-15')).toEqual({ from: '2026-10-26', to: '2026-12-06' })
  })

  it('шаг: день, неделя, месяц (в коротком месяце на последний день), через границу года', () => {
    expect(shiftAnchor('day', '2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftAnchor('week', '2026-11-07', -1)).toBe('2026-10-31')
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-28')
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-15')
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-15')
  })

  it('заголовки периода', () => {
    expect(formatPeriod('month', '2026-11-07')).toBe('Ноябрь 2026')
    expect(formatPeriod('day', '2026-11-07')).toBe('Суббота, 7 ноября')
    expect(formatPeriod('week', '2026-11-07')).toBe('2–8 ноября')
    expect(formatPeriod('week', '2026-11-01')).toMatch(/^26 окт.?–1 ноября$/)
  })
})

describe('государственные праздники', () => {
  it('фиксированные даты каждый год', () => {
    expect(holidayOn('2026-01-01')).toBe('Новый год')
    expect(holidayOn('2027-01-07')).toBe('Рождество Христово')
    expect(holidayOn('2026-01-04')).toBe('Новогодние каникулы')
    expect(holidayOn('2026-02-23')).toBe('День защитника Отечества')
    expect(holidayOn('2026-03-08')).toBe('Международный женский день')
    expect(holidayOn('2026-05-01')).toBe('Праздник Весны и Труда')
    expect(holidayOn('2026-05-09')).toBe('День Победы')
    expect(holidayOn('2026-06-12')).toBe('День России')
    expect(holidayOn('2026-11-04')).toBe('День народного единства')
  })

  it('обычные дни без праздника', () => {
    expect(holidayOn('2026-11-05')).toBeNull()
    expect(holidayOn('2026-01-09')).toBeNull()
    expect(holidayOn('2026-12-31')).toBeNull()
  })

  it('записи праздников за период', () => {
    const items = holidayItems('2026-10-26', '2026-12-06')
    expect(items.map((i) => [i.date, i.title])).toEqual([['2026-11-04', 'День народного единства']])
    expect(items[0]).toMatchObject({ kind: 'holiday', start: null, end: null, memberIds: [], href: null })
  })
})

describe('события', () => {
  it('однодневное со временем', () => {
    const [item] = eventItems([event()], '2026-11-01', '2026-11-30')
    expect(item).toMatchObject({ kind: 'event', date: '2026-11-07', start: '18:00', end: '20:30', memberIds: [], href: '/calendar/events/e1' })
    expect(timeLabel(item)).toBe('18:00–20:30')
  })

  it('многодневное: по записи на день, в первый день начало, в последний конец, между ними весь день', () => {
    const items = eventItems([event({ startDate: '2026-11-07', endDate: '2026-11-09', startTime: '20:00', endTime: '09:00' })], '2026-11-01', '2026-11-30')
    expect(items.map((i) => [i.date, i.start, i.end])).toEqual([
      ['2026-11-07', '20:00', null],
      ['2026-11-08', null, null],
      ['2026-11-09', null, '09:00'],
    ])
    expect(items.map(timeLabel)).toEqual(['с 20:00', 'Весь день', 'до 09:00'])
  })

  it('обрезается периодом; событие на несколько дней без времени', () => {
    const items = eventItems([event({ startDate: '2026-10-30', endDate: '2026-11-03', startTime: null, endTime: null })], '2026-11-01', '2026-11-02')
    expect(items.map((i) => i.date)).toEqual(['2026-11-01', '2026-11-02'])
  })

  it('событие не для всей семьи привязано к автору и участникам', () => {
    const [item] = eventItems([event({ allFamily: false, memberIds: ['kid'], authorId: 'mama' })], '2026-11-01', '2026-11-30')
    expect(item.memberIds.sort()).toEqual(['kid', 'mama'])
  })
})

describe('задания, дни рождения, тренировки', () => {
  it('задания периода с отметкой выполнения; без срока и вне периода пропускаются', () => {
    const list: TaskList = {
      tasks: [task({ id: 'a', title: 'Убрать', assigneeId: 'kid', time: '17:00' }), task({ id: 'b', title: 'Без срока', assigneeId: 'kid' })],
      occurrences: [
        { taskId: 'a', date: '2026-11-05', done: { memberId: 'kid', at: '2026-11-05T10:00:00Z' }, pending: null },
        { taskId: 'a', date: '2026-12-31', done: null, pending: null },
        { taskId: 'b', date: null, done: null, pending: null },
      ],
    }
    const items = taskItems(list, '2026-11-01', '2026-11-30')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'task', title: 'Убрать', date: '2026-11-05', start: '17:00', done: true, memberIds: ['kid'], href: '/tasks/a?date=2026-11-05' })
    expect(taskItems(undefined, '2026-11-01', '2026-11-30')).toEqual([])
    // с составом семьи в подписи исполнитель
    expect(taskItems(list, '2026-11-01', '2026-11-30', [member('kid', null)], 'mama')[0].subtitle).toBe('Исполнитель: kid')
  })

  it('день рождения повторяется каждый год, возраст считается; в год рождения записи нет', () => {
    const members = [member('kid', '2016-11-12'), member('baby', '2026-11-20'), member('none', null)]
    const items = birthdayItems(members, '2026-11-01', '2026-11-30', 'mama')
    expect(items.map((i) => [i.date, i.title, i.subtitle])).toEqual([['2026-11-12', 'День рождения: kid', 'Исполняется 10']])
    expect(items[0]).toMatchObject({ kind: 'birthday', memberIds: ['kid'], href: '/family/kid' })
  })

  it('период на стыке годов и 29 февраля в невисокосный год', () => {
    const jan = birthdayItems([member('kid', '2015-01-03')], '2026-12-28', '2027-01-10', 'mama')
    expect(jan.map((i) => [i.date, i.subtitle])).toEqual([['2027-01-03', 'Исполняется 12']])
    const leap = birthdayItems([member('kid', '2016-02-29')], '2026-02-01', '2026-03-05', 'mama')
    expect(leap.map((i) => i.date)).toEqual(['2026-02-28'])
    expect(birthdayItems([member('kid', '2016-02-29')], '2028-02-01', '2028-03-05', 'mama').map((i) => i.date)).toEqual(['2028-02-29'])
  })

  it('ребёнок видит родителей как «Мама» и «Папа»', () => {
    const [item] = birthdayItems([member('m', '1985-11-05', 'mama')], '2026-11-01', '2026-11-30', 'child')
    expect(item.title).toBe('День рождения: Мама')
  })

  it('тренировки повторяются каждую неделю; у чужого ребёнка подпись с именем, у своего ссылка на профиль', () => {
    const members = [member('kid', null), member('sis', null)]
    const trainings = { kid: [{ weekday: 2, title: 'Плавание', place: 'Бассейн', startsAt: '17:00', endsAt: '18:00' }], sis: undefined }
    const items = trainingItems(trainings, members, '2026-11-02', '2026-11-15', 'mama')
    expect(items.map((i) => i.date)).toEqual(['2026-11-03', '2026-11-10'])
    expect(items[0]).toMatchObject({ kind: 'training', title: 'Плавание', subtitle: 'kid · Бассейн', start: '17:00', end: '18:00', href: '/family/kid/trainings' })
    const own = trainingItems(trainings, members, '2026-11-02', '2026-11-08', 'kid')
    expect(own[0]).toMatchObject({ subtitle: 'Бассейн', href: '/profile/trainings' })
  })
})

describe('фильтр по настройкам и порядок', () => {
  const item = (over: Partial<CalendarItem>): CalendarItem => ({ key: 'k', kind: 'event', title: 'X', date: '2026-11-07', start: null, end: null, memberIds: [], href: null, ...over })

  it('скрытые виды не показываются', () => {
    const items = [item({ kind: 'task', key: 'a' }), item({ kind: 'event', key: 'b' })]
    expect(visibleItems(items, { ...DEFAULT_SETTINGS, kinds: { ...DEFAULT_SETTINGS.kinds, task: false } }).map((i) => i.key)).toEqual(['b'])
  })

  it('скрытый человек: его записи пропадают, общие остаются, запись с несколькими людьми пока виден хоть один', () => {
    const items = [
      item({ key: 'kid', memberIds: ['kid'] }),
      item({ key: 'both', memberIds: ['kid', 'mama'] }),
      item({ key: 'common', memberIds: [] }),
    ]
    const hidden = { ...DEFAULT_SETTINGS, hiddenMembers: ['kid'] }
    expect(visibleItems(items, hidden).map((i) => i.key)).toEqual(['both', 'common'])
    expect(visibleItems(items, { ...DEFAULT_SETTINGS, hiddenMembers: ['kid', 'mama'] }).map((i) => i.key)).toEqual(['common'])
  })

  it('порядок: на весь день сверху (праздник, день рождения, событие), потом по времени', () => {
    const items = [
      item({ key: 'late', start: '19:00' }),
      item({ key: 'event', kind: 'event' }),
      item({ key: 'holiday', kind: 'holiday' }),
      item({ key: 'early', kind: 'task', start: '08:00' }),
      item({ key: 'birthday', kind: 'birthday' }),
    ]
    expect([...items].sort(compareItems).map((i) => i.key)).toEqual(['holiday', 'birthday', 'event', 'early', 'late'])
  })

  it('группировка по дням', () => {
    const grouped = groupByDay([item({ key: 'a', date: '2026-11-08' }), item({ key: 'b', date: '2026-11-07' }), item({ key: 'c', date: '2026-11-07', start: '09:00' })])
    expect([...grouped.keys()]).toEqual(['2026-11-07', '2026-11-08'])
    expect(grouped.get('2026-11-07')!.map((i) => i.key)).toEqual(['b', 'c'])
  })
})

describe('настройки календаря в хранилище', () => {
  beforeEach(() => localStorage.clear())

  it('по умолчанию всё включено, месяц', () => {
    expect(loadSettings('m1')).toEqual(DEFAULT_SETTINGS)
  })

  it('сохраняются для каждого участника отдельно', () => {
    saveSettings('m1', { view: 'week', kinds: { ...DEFAULT_SETTINGS.kinds, holiday: false }, hiddenMembers: ['kid'] })
    expect(loadSettings('m1')).toEqual({ view: 'week', kinds: { ...DEFAULT_SETTINGS.kinds, holiday: false }, hiddenMembers: ['kid'] })
    expect(loadSettings('m2')).toEqual(DEFAULT_SETTINGS)
  })

  it('испорченное и неполное хранилище не ломает календарь', () => {
    localStorage.setItem('calendar-settings:m1', '{не json')
    expect(loadSettings('m1')).toEqual(DEFAULT_SETTINGS)
    localStorage.setItem('calendar-settings:m1', JSON.stringify({ view: 'год', kinds: { task: false, holiday: 'да' }, hiddenMembers: ['a', 5] }))
    expect(loadSettings('m1')).toEqual({ view: 'month', kinds: { ...DEFAULT_SETTINGS.kinds, task: false }, hiddenMembers: ['a'] })
    localStorage.setItem('calendar-settings:m1', 'null')
    expect(loadSettings('m1')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('полоса суток: раскладка записей', () => {
  const at = (key: string, start: string | null, end: string | null, over: Partial<CalendarItem> = {}): CalendarItem => ({
    key,
    kind: 'event',
    title: key,
    date: '2026-11-07',
    start,
    end,
    memberIds: [],
    href: null,
    ...over,
  })
  const place = (items: CalendarItem[]) => placeTimed(items).map((p) => [p.item.key, p.startMin, p.endMin, p.column, p.columns])

  it('записи без времени на полосу не попадают', () => {
    expect(placeTimed([at('весь день', null, null)])).toEqual([])
    expect(isAllDay(at('x', null, null))).toBe(true)
    expect(isAllDay(at('x', '10:00', null))).toBe(false)
  })

  it('один блок занимает от начала до конца на всю ширину', () => {
    expect(place([at('a', '10:00', '11:30')])).toEqual([['a', 600, 690, 0, 1]])
  })

  it('без конца: событие до конца суток, задание и слишком короткое растягиваются до 50 минут (две строки подписи), тренировка час', () => {
    expect(place([at('событие', '20:00', null)])).toEqual([['событие', 1200, 1440, 0, 1]])
    expect(place([at('задание', '16:00', null, { kind: 'task' })])).toEqual([['задание', 960, 1010, 0, 1]])
    expect(place([at('тренировка', '17:00', null, { kind: 'training' })])).toEqual([['тренировка', 1020, 1080, 0, 1]])
    expect(place([at('короткое', '09:00', '09:10')])).toEqual([['короткое', 540, 590, 0, 1]])
  })

  it('последний день многодневного события идёт с полуночи до конца', () => {
    expect(place([at('ночёвка', null, '09:00')])).toEqual([['ночёвка', 0, 540, 0, 1]])
  })

  it('пересекающиеся делят ширину колонками, не пересекающиеся стоят на всю ширину', () => {
    const rows = place([at('a', '10:00', '12:00'), at('b', '11:00', '12:30'), at('c', '12:00', '13:00'), at('d', '15:00', '16:00')])
    expect(rows).toEqual([
      ['a', 600, 720, 0, 2],
      ['b', 660, 750, 1, 2],
      // c начинается, когда a закончилась: берёт её колонку, группа общая с b
      ['c', 720, 780, 0, 2],
      ['d', 900, 960, 0, 1],
    ])
  })

  it('три записи одновременно в трёх колонках', () => {
    const rows = place([at('a', '10:00', '11:00'), at('b', '10:00', '11:00'), at('c', '10:30', '11:30')])
    expect(rows.map((r) => r[4])).toEqual([3, 3, 3])
    expect(new Set(rows.map((r) => r[3])).size).toBe(3)
  })
})
