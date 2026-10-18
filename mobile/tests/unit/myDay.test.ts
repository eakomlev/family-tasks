import { describe, expect, it } from 'vitest'
import { getGreeting } from '@/features/myDay/utils'
import { lessonsForDay, pickLessonDay, pickTrainingDay, trainingSummary } from '@/features/myDay/schedule'

// 12 октября 2026 года — понедельник
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour)
const MON = 12, FRI = 16, SAT = 17, SUN = 18

const lesson = (weekday: number, subject = 'Математика') => ({ weekday, subject, startsAt: null, endsAt: null, room: null as string | null })
const training = (weekday: number, title = 'Плавание', startsAt: string | null = null) => ({
  weekday,
  title,
  place: null,
  startsAt,
  endsAt: null,
})

describe('getGreeting', () => {
  it.each([
    [4, 'Доброй ночи'],
    [5, 'Доброе утро'],
    [11, 'Доброе утро'],
    [12, 'Добрый день'],
    [17, 'Добрый день'],
    [18, 'Добрый вечер'],
    [22, 'Добрый вечер'],
    [23, 'Доброй ночи'],
    [0, 'Доброй ночи'],
  ])('в %i ч — %s', (hour, text) => {
    expect(getGreeting(at(MON, hour)).text).toBe(text)
  })
})

describe('pickLessonDay: какой день уроков показать', () => {
  const week = [1, 2, 3, 4, 5].map((d) => lesson(d))

  it('днём сегодняшний', () => {
    expect(pickLessonDay(at(MON, 10), week)).toEqual({ weekday: 1, label: 'сегодня' })
  })

  it('с 18:00 завтрашний', () => {
    expect(pickLessonDay(at(MON, 18), week)).toEqual({ weekday: 2, label: 'завтра' })
    expect(pickLessonDay(at(MON, 17), week)).toEqual({ weekday: 1, label: 'сегодня' })
  })

  it('в пятницу вечером ближайший понедельник, если в субботу уроков нет', () => {
    expect(pickLessonDay(at(FRI, 19), week)).toEqual({ weekday: 1, label: 'в понедельник' })
  })

  it('в пятницу вечером суббота, если в ней есть уроки', () => {
    expect(pickLessonDay(at(FRI, 19), [...week, lesson(6)])).toEqual({ weekday: 6, label: 'завтра' })
  })

  it('суббота и воскресенье без уроков дают понедельник', () => {
    expect(pickLessonDay(at(SAT, 9), week)).toEqual({ weekday: 1, label: 'в понедельник' })
    expect(pickLessonDay(at(SUN, 9), week)).toEqual({ weekday: 1, label: 'завтра' })
  })

  it('воскресенье вечером понедельник тоже «завтра»', () => {
    expect(pickLessonDay(at(SUN, 20), week)).toEqual({ weekday: 1, label: 'завтра' })
  })

  it('суббота с уроками днём показывает сегодняшний день', () => {
    expect(pickLessonDay(at(SAT, 9), [...week, lesson(6)])).toEqual({ weekday: 6, label: 'сегодня' })
  })

  it('суббота с уроками вечером ведёт на понедельник', () => {
    expect(pickLessonDay(at(SAT, 19), [...week, lesson(6)])).toEqual({ weekday: 1, label: 'в понедельник' })
  })

  it('без единого урока цикл не зависает', () => {
    expect(pickLessonDay(at(SAT, 9), [])).toEqual({ weekday: 1, label: 'в понедельник' })
  })
})

describe('lessonsForDay', () => {
  it('берёт уроки нужного дня в порядке расписания', () => {
    const items = lessonsForDay([lesson(1, 'А'), lesson(2, 'Б'), lesson(1, 'В')], 1)
    expect(items.map((i) => i.subject)).toEqual(['А', 'В'])
    expect(new Set(items.map((i) => i.key)).size).toBe(2)
  })
})

describe('pickTrainingDay: какой день тренировок показать', () => {
  it('сегодня, если есть', () => {
    const day = pickTrainingDay(at(MON, 10), [training(1, 'Плавание', '18:00')])
    expect(day).toMatchObject({ weekday: 1, label: 'сегодня' })
    expect(day!.trainings).toHaveLength(1)
  })

  it('сегодняшняя тренировка остаётся, пока не закончилась', () => {
    expect(pickTrainingDay(at(MON, 18), [training(1, 'Плавание', '19:00'), training(2)])).toMatchObject({ weekday: 1, label: 'сегодня' })
    expect(pickTrainingDay(at(MON, 18), [training(1), training(2)])).toMatchObject({ weekday: 1, label: 'сегодня' })
  })

  it('прошедшая сегодня тренировка не показывается, берётся следующий день', () => {
    expect(pickTrainingDay(at(MON, 20), [training(1, 'Плавание', '19:00'), training(2)])).toMatchObject({ weekday: 2, label: 'завтра' })
  })

  it('ближайший день с тренировками получает название дня недели', () => {
    expect(pickTrainingDay(at(MON, 10), [training(3)])).toMatchObject({ weekday: 3, label: 'в среду' })
  })

  it('переход через воскресенье', () => {
    expect(pickTrainingDay(at(SAT, 10), [training(1)])).toMatchObject({ weekday: 1, label: 'в понедельник' })
    expect(pickTrainingDay(at(SUN, 10), [training(7)])).toMatchObject({ weekday: 7, label: 'сегодня' })
  })

  it('единственная прошедшая сегодня тренировка — «через неделю»', () => {
    expect(pickTrainingDay(at(MON, 20), [training(1, 'Плавание', '19:00')])).toMatchObject({ weekday: 1, label: 'через неделю' })
  })

  it('без тренировок null', () => {
    expect(pickTrainingDay(at(MON, 10), [])).toBeNull()
  })

  it('trainingSummary', () => {
    const day = pickTrainingDay(at(MON, 10), [training(1, 'Плавание', '18:00'), training(1, 'Растяжка')])!
    expect(trainingSummary(day)).toBe('Плавание 18:00 · Растяжка')
  })
})
