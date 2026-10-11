import { describe, expect, it } from 'vitest'
import { byTimeThenTitle, occurrenceKey, sameOccurrence, toEntries } from '@/lib/occurrences'
import { taskMeta } from '@/components/TaskItem/utils'
import { buildDone, buildSections } from '@/pages/Tasks/utils'
import { emptyForm, fromTask, toInput, validate } from '@/pages/TaskForm/utils'
import { occ, task } from '../helpers'

const TODAY = '2026-10-11'

describe('toEntries', () => {
  const list = {
    tasks: [task({ id: 'a', assigneeId: 'm1' }), task({ id: 'b', assigneeId: 'm2' })],
    occurrences: [occ('a', null), occ('b', null), occ('ghost', null)],
  }

  it('склеивает вхождения с заданиями и отбрасывает вхождения без задания', () => {
    expect(toEntries(list, null).map((e) => e.task.id)).toEqual(['a', 'b'])
  })

  it('фильтрует по исполнителю', () => {
    expect(toEntries(list, 'm2').map((e) => e.task.id)).toEqual(['b'])
    expect(toEntries(list, 'nobody')).toEqual([])
  })
})

describe('occurrenceKey и sameOccurrence', () => {
  it('различают дни одного повторяющегося задания и отсутствие даты', () => {
    expect(occurrenceKey('a', '2026-10-11')).not.toBe(occurrenceKey('a', '2026-10-12'))
    expect(occurrenceKey('a', null)).toBe('a|none')
    expect(sameOccurrence(occ('a', '2026-10-11'), 'a', '2026-10-11')).toBe(true)
    expect(sameOccurrence(occ('a', '2026-10-11'), 'a', '2026-10-12')).toBe(false)
    expect(sameOccurrence(occ('a', null), 'a', null)).toBe(true)
    expect(sameOccurrence(occ('a', null), 'b', null)).toBe(false)
  })
})

describe('byTimeThenTitle', () => {
  const entry = (title: string, time: string | null) => ({ task: task({ title, time }), occurrence: occ('t1', null) })

  it('сначала с временем по возрастанию, потом без времени по названию', () => {
    const sorted = [entry('Я', null), entry('Б', '18:00'), entry('А', null), entry('В', '09:00')].sort(byTimeThenTitle)
    expect(sorted.map((e) => e.task.title)).toEqual(['В', 'Б', 'А', 'Я'])
  })

  it('одинаковое время: по названию, ё и е по-русски', () => {
    const sorted = [entry('Ёлка', '10:00'), entry('Арбуз', '10:00')].sort(byTimeThenTitle)
    expect(sorted.map((e) => e.task.title)).toEqual(['Арбуз', 'Ёлка'])
  })
})

describe('taskMeta', () => {
  it('просрочено, время и повтор', () => {
    const t = task({ time: '18:00', repeat: { type: 'daily', days: [], until: null } })
    const { parts, late } = taskMeta(t, occ('t1', '2026-10-09'), TODAY)
    expect(late).toBe(true)
    expect(parts).toEqual(['Просрочено, 9 октября', '18:00', 'каждый день'])
  })

  it('повтор «до даты»', () => {
    const t = task({ repeat: { type: 'weekly', days: [1, 3], until: '2026-12-01' } })
    expect(taskMeta(t, occ('t1', TODAY), TODAY).parts).toEqual(['по пн, ср до 1 декабря'])
  })

  it('дата вхождения по запросу; у просроченного она уже в подписи «Просрочено»', () => {
    expect(taskMeta(task(), occ('t1', '2026-10-12'), TODAY, true).parts).toEqual(['12 октября'])
    expect(taskMeta(task(), occ('t1', '2026-10-09'), TODAY, true).parts).toEqual(['Просрочено, 9 октября'])
    expect(taskMeta(task(), occ('t1', null), TODAY, true).parts).toEqual([])
  })

  it('выполненное прошлое не считается просроченным', () => {
    expect(taskMeta(task(), occ('t1', '2026-10-09', true), TODAY)).toEqual({ parts: [], late: false })
  })

  it('сегодняшнее и без срока не просрочены', () => {
    expect(taskMeta(task(), occ('t1', TODAY), TODAY).late).toBe(false)
    expect(taskMeta(task(), occ('t1', null), TODAY).late).toBe(false)
  })
})

describe('buildSections', () => {
  const list = {
    tasks: [
      task({ id: 'old', title: 'Старое' }),
      task({ id: 'oldDone', title: 'Старое выполненное' }),
      task({ id: 'today', title: 'Сегодня' }),
      task({ id: 'tomorrow', title: 'Завтра' }),
      task({ id: 'later', title: 'Позже' }),
      task({ id: 'none', title: 'Без срока' }),
    ],
    occurrences: [
      occ('none', null),
      occ('later', '2026-10-15'),
      occ('tomorrow', '2026-10-12'),
      occ('today', TODAY),
      occ('oldDone', '2026-10-01', true),
      occ('old', '2026-10-01'),
    ],
  }

  it('просроченное, затем по дням по порядку, затем «без срока»', () => {
    const sections = buildSections(list, TODAY, null)
    expect(sections.map((s) => s.key)).toEqual(['overdue', TODAY, '2026-10-12', '2026-10-15', 'undated'])
    expect(sections[0].title).toBe('Просрочено')
    expect(sections[0].items.map((i) => i.task.id)).toEqual(['old'])
  })

  it('выполненное в «Предстоящие» не попадает: ни сегодняшнее, ни просроченное, ни без срока', () => {
    const l = {
      tasks: [task({ id: 'a', title: 'А' }), task({ id: 'b', title: 'Б' }), task({ id: 'c', title: 'В' }), task({ id: 'd', title: 'Г' })],
      occurrences: [occ('a', TODAY, true), occ('b', '2026-10-01', true), occ('c', null, true), occ('d', TODAY)],
    }
    const sections = buildSections(l, TODAY, null)
    expect(sections.map((s) => s.key)).toEqual([TODAY])
    expect(sections[0].items.map((i) => i.task.id)).toEqual(['d'])
  })

  it('если всё выполнено, секций нет', () => {
    const l = { tasks: [task({ id: 'a' })], occurrences: [occ('a', TODAY, true)] }
    expect(buildSections(l, TODAY, null)).toEqual([])
  })

  it('ожидающее проверки родителем ещё не выполнено и остаётся в списке (у ребёнка)', () => {
    const l = { tasks: [task({ id: 'a' })], occurrences: [occ('a', TODAY, false, true)] }
    expect(buildSections(l, TODAY, null)[0].items.map((i) => i.task.id)).toEqual(['a'])
  })

  it('заголовки дней: Сегодня и Завтра', () => {
    const titles = buildSections(list, TODAY, null).map((s) => s.title)
    expect(titles).toContain('Сегодня')
    expect(titles).toContain('Завтра')
    expect(titles.at(-1)).toBe('Без срока')
  })

  it('пустой список даёт ноль секций', () => {
    expect(buildSections({ tasks: [], occurrences: [] }, TODAY, null)).toEqual([])
  })

  it('фильтр по исполнителю убирает пустые секции', () => {
    const l = {
      tasks: [task({ id: 'x', assigneeId: 'm2' })],
      occurrences: [occ('x', TODAY)],
    }
    expect(buildSections(l, TODAY, 'm1')).toEqual([])
  })

  it('buildDone сохраняет порядок сервера', () => {
    const l = { tasks: [task({ id: 'a' }), task({ id: 'b' })], occurrences: [occ('b', null, true), occ('a', null, true)] }
    expect(buildDone(l, null).map((e) => e.task.id)).toEqual(['b', 'a'])
  })
})

describe('форма задания', () => {
  it('toInput обрезает название, без даты время сбрасывается', () => {
    const input = toInput({ ...emptyForm('m1'), title: '  Купить хлеб ', time: '10:00' })
    expect(input.title).toBe('Купить хлеб')
    expect(input.description).toBe('')
    expect(input.reward).toBe(0)
    expect(input.date).toBeNull()
    expect(input.time).toBeNull()
  })

  it('с датой время сохраняется', () => {
    const input = toInput({ ...emptyForm('m1'), title: 'x', scheduled: true, date: '2026-10-12', time: '10:00' })
    expect(input).toMatchObject({ date: '2026-10-12', time: '10:00' })
  })

  it('без галочки «Указать время» дата, время и повтор не уходят, даже если остались в форме', () => {
    const input = toInput({ ...emptyForm('m1'), title: 'x', scheduled: false, date: '2026-10-12', time: '10:00', repeatType: 'daily', until: '2026-12-01' })
    expect(input).toMatchObject({ date: null, time: null, repeat: { type: 'none', days: [], until: null } })
  })

  it('награда: число из строки, пусто и мусор это 0', () => {
    const base = { ...emptyForm('m1'), title: 'x' }
    expect(toInput({ ...base, reward: '20' }).reward).toBe(20)
    expect(toInput({ ...base, reward: '' }).reward).toBe(0)
    expect(toInput({ ...base, reward: 'abc' }).reward).toBe(0)
  })

  it('fromTask: награда вне готовых плашек помечается как «Другая», у задания с датой стоит галочка «Указать время»', () => {
    expect(fromTask(task({ reward: 20, date: null }))).toMatchObject({ reward: '20', rewardCustom: false, scheduled: false })
    expect(fromTask(task({ reward: 37, date: '2026-10-12' }))).toMatchObject({ reward: '37', rewardCustom: true, scheduled: true })
    expect(fromTask(task({ reward: 0 }))).toMatchObject({ reward: '0', rewardCustom: false })
  })

  it('дни недели уходят только у weekly, until только у повторяющихся', () => {
    const base = { ...emptyForm('m1'), title: 'x', scheduled: true, date: '2026-10-12', days: [1, 3], until: '2026-12-01' }
    expect(toInput({ ...base, repeatType: 'daily' }).repeat).toEqual({ type: 'daily', days: [], until: '2026-12-01' })
    expect(toInput({ ...base, repeatType: 'weekly' }).repeat).toEqual({ type: 'weekly', days: [1, 3], until: '2026-12-01' })
    expect(toInput({ ...base, repeatType: 'none' }).repeat).toEqual({ type: 'none', days: [], until: null })
  })

  it('fromTask и toInput взаимно обратны', () => {
    const t = task({
      title: 'Поливать',
      description: 'Не заливать',
      reward: 15,
      assigneeId: 'm2',
      date: '2026-10-12',
      time: '08:00',
      repeat: { type: 'weekly', days: [2, 4], until: '2026-11-01' },
    })
    const { id: _id, authorId: _author, createdAt: _created, ...input } = t
    expect(toInput(fromTask(t))).toEqual(input)
  })

  describe('validate', () => {
    it('пустое название', () => {
      expect(validate({ ...emptyForm('m1'), title: '   ' })).toMatch(/название/)
    })
    it('weekly без дней', () => {
      expect(validate({ ...emptyForm('m1'), title: 'x', repeatType: 'weekly' })).toMatch(/день недели/)
    })
    it('конец повтора раньше начала', () => {
      const form = { ...emptyForm('m1'), title: 'x', scheduled: true, date: '2026-10-12', repeatType: 'daily' as const, until: '2026-10-01' }
      expect(validate(form)).toMatch(/раньше/)
    })
    it('конец повтора в тот же день допустим', () => {
      const form = { ...emptyForm('m1'), title: 'x', scheduled: true, date: '2026-10-12', repeatType: 'daily' as const, until: '2026-10-12' }
      expect(validate(form)).toBeUndefined()
    })
    it('галочка «Указать время» без даты', () => {
      expect(validate({ ...emptyForm('m1'), title: 'x', scheduled: true, date: '' })).toMatch(/Укажите дату/)
    })
    it('своя награда: целое число от 1 до 1000', () => {
      const own = (reward: string) => validate({ ...emptyForm('m1'), title: 'x', rewardCustom: true, reward })
      for (const bad of ['', '0', '1001', '2.5', '-5', 'abc']) expect(own(bad)).toMatch(/от 1 до 1000/)
      for (const good of ['1', '37', '1000']) expect(own(good)).toBeUndefined()
    })
    it('готовая награда не проверяется как своя', () => {
      expect(validate({ ...emptyForm('m1'), title: 'x', rewardCustom: false, reward: '0' })).toBeUndefined()
    })
    it('корректная форма', () => {
      expect(validate({ ...emptyForm('m1'), title: 'x' })).toBeUndefined()
    })
  })
})
