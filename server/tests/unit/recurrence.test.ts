import { describe, expect, it } from 'vitest'
import { addDays, isoWeekday, isRealDate, NO_DATE, occursOn, occurrencesBetween, previousOccurrence, type Schedule } from '../../src/tasks/recurrence.js'

const S = (date: string | null, repeatType: Schedule['repeatType'] = 'none', repeatDays: number[] = [], repeatUntil: string | null = null): Schedule => ({
  date,
  repeatType,
  repeatDays,
  repeatUntil,
})

describe('даты', () => {
  it('день недели в формате ISO (воскресенье = 7)', () => {
    // 5 октября 2026 — понедельник
    expect(['2026-10-05', '2026-10-10', '2026-10-11'].map(isoWeekday)).toEqual([1, 6, 7])
  })

  it('addDays переходит через месяц, год и високосный февраль', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('isRealDate отсекает несуществующие даты и неверный формат', () => {
    expect(['2026-02-29', '2028-02-29', '2026-13-01', '2026-4-1', '2026-04-31', '2026-04-30'].map(isRealDate)).toEqual([
      false, true, false, false, false, true,
    ])
  })

  it('для задания без даты в таблице отметок используется заглушка', () => {
    expect(NO_DATE).toBe('1970-01-01')
  })
})

describe('occursOn и occurrencesBetween', () => {
  it('разовое задание бывает только в свой день', () => {
    const task = S('2026-10-10')
    expect([task, task, task].map((t, i) => occursOn(t, ['2026-10-09', '2026-10-10', '2026-10-11'][i]))).toEqual([false, true, false])
  })

  it('задание без даты никогда не «происходит»', () => {
    expect(occursOn(S(null), '2026-10-10')).toBe(false)
    expect(occurrencesBetween(S(null), '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('ежедневное начинается с даты задания, а не раньше', () => {
    expect(occurrencesBetween(S('2026-10-05', 'daily'), '2026-10-03', '2026-10-08')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    ])
  })

  it('дата окончания входит в повтор включительно', () => {
    expect(occurrencesBetween(S('2026-10-05', 'daily', [], '2026-10-07'), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07',
    ])
  })

  it('по дням недели: пн, ср, сб', () => {
    expect(occurrencesBetween(S('2026-10-01', 'weekly', [1, 3, 6]), '2026-10-05', '2026-10-18')).toEqual([
      '2026-10-05', '2026-10-07', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-17',
    ])
  })

  it('по дням недели: воскресенье это 7', () => {
    expect(occurrencesBetween(S('2026-10-01', 'weekly', [7]), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25',
    ])
  })

  it('недельное не срабатывает раньше даты начала', () => {
    expect(occurrencesBetween(S('2026-10-08', 'weekly', [1]), '2026-10-01', '2026-10-20')).toEqual(['2026-10-12', '2026-10-19'])
  })

  it('раз в месяц: то же число', () => {
    expect(occurrencesBetween(S('2026-10-15', 'monthly'), '2026-10-01', '2027-01-31')).toEqual([
      '2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15',
    ])
  })

  it('раз в месяц: 31-е число в коротких месяцах переходит на последний день', () => {
    expect(occurrencesBetween(S('2026-01-31', 'monthly'), '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
    ])
  })

  it('раз в месяц: 29-е в феврале високосного и обычного года', () => {
    const task = S('2027-01-29', 'monthly')
    expect(occurrencesBetween(task, '2028-02-01', '2028-02-29')).toEqual(['2028-02-29'])
    expect(occurrencesBetween(task, '2027-02-01', '2027-02-28')).toEqual(['2027-02-28'])
  })

  it('раз в месяц: в коротком месяце не бывает двух попаданий', () => {
    expect(occurrencesBetween(S('2026-01-30', 'monthly'), '2026-02-01', '2026-02-28')).toEqual(['2026-02-28'])
  })

  it('раз в месяц с датой окончания', () => {
    expect(occurrencesBetween(S('2026-10-15', 'monthly', [], '2026-11-30'), '2026-10-01', '2027-03-01')).toEqual([
      '2026-10-15', '2026-11-15',
    ])
  })

  it('диапазон через границу года', () => {
    expect(occurrencesBetween(S('2026-12-30', 'daily'), '2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ])
  })

  it('пустой или перевёрнутый диапазон даёт пустой список', () => {
    expect(occurrencesBetween(S('2026-10-05', 'daily'), '2026-10-10', '2026-10-09')).toEqual([])
    expect(occurrencesBetween(S('2026-10-05', 'daily', [], '2026-10-01'), '2026-10-01', '2026-10-31')).toEqual([])
  })
})

describe('previousOccurrence', () => {
  it('ежедневное: вчера, а в первый день серии ничего', () => {
    expect(previousOccurrence(S('2026-10-01', 'daily'), '2026-10-12')).toBe('2026-10-11')
    expect(previousOccurrence(S('2026-10-12', 'daily'), '2026-10-12')).toBeNull()
  })

  it('недельное: ближайший подходящий день недели раньше', () => {
    // пн и ср: перед средой 14 октября это понедельник 12-го, перед понедельником 12-го это среда 7-го
    const s = S('2026-09-01', 'weekly', [1, 3])
    expect(previousOccurrence(s, '2026-10-14')).toBe('2026-10-12')
    expect(previousOccurrence(s, '2026-10-12')).toBe('2026-10-07')
    expect(previousOccurrence(s, '2026-10-15')).toBe('2026-10-14')
  })

  it('ежемесячное: на то же число прошлого месяца, в коротком месяце на последний день', () => {
    const s = S('2026-01-31', 'monthly')
    expect(previousOccurrence(s, '2026-03-31')).toBe('2026-02-28')
    expect(previousOccurrence(s, '2026-03-05')).toBe('2026-02-28')
    expect(previousOccurrence(S('2026-01-15', 'monthly'), '2026-03-20')).toBe('2026-03-15')
  })

  it('учитывает конец повтора и отсутствие даты', () => {
    expect(previousOccurrence(S('2026-10-01', 'daily', [], '2026-10-05'), '2026-10-12')).toBe('2026-10-05')
    expect(previousOccurrence(S(null), '2026-10-12')).toBeNull()
  })

  it('разовое задание: только если оно в прошлом', () => {
    expect(previousOccurrence(S('2026-10-10'), '2026-10-12')).toBe('2026-10-10')
    expect(previousOccurrence(S('2026-10-20'), '2026-10-12')).toBeNull()
  })
})
