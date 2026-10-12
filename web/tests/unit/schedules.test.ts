import { describe, expect, it } from 'vitest'
import { defaultDay, fromLessons, hasInvalidTime, newLesson, toLessons } from '@/pages/Schedule/utils'
import {
  defaultDay as defaultTrainingDay,
  fromTrainings,
  hasInvalidTime as trainingInvalidTime,
  newTraining,
  toTrainings,
} from '@/pages/Trainings/utils'
import { getGreeting, lessonsForDay, pickLessonDay, pickTrainingDay, trainingSummary } from '@/pages/MyDay/utils'

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

describe('расписание уроков: черновик и сохранение', () => {
  it('fromLessons раскладывает по дням, пустые дни есть', () => {
    const days = fromLessons([lesson(1, 'А'), lesson(1, 'Б'), lesson(3, 'В')])
    expect(days[1].map((l) => l.subject)).toEqual(['А', 'Б'])
    expect(days[2]).toEqual([])
    expect(days[6]).toEqual([])
  })

  it('toLessons отбрасывает пустые, обрезает пробелы, пустое время превращает в null, сохраняет порядок', () => {
    const days = fromLessons([])
    days[1] = [
      { ...newLesson(), subject: ' Русский ', startsAt: '08:30' },
      { ...newLesson(), subject: '   ' },
      { ...newLesson(), subject: 'Чтение' },
    ]
    expect(toLessons(days)).toEqual([
      { weekday: 1, subject: 'Русский', startsAt: '08:30', endsAt: null, room: null },
      { weekday: 1, subject: 'Чтение', startsAt: null, endsAt: null, room: null },
    ])
  })

  it('кабинет: обрезается, пустой становится null, при загрузке и сохранении не теряется', () => {
    const days = fromLessons([{ ...lesson(1, 'Химия'), room: '12а' }])
    expect(days[1][0].room).toBe('12а')
    days[1].push({ ...newLesson(), subject: 'Физика', room: '  305 ' }, { ...newLesson(), subject: 'Труд', room: '   ' })
    expect(toLessons(days).map((l) => l.room)).toEqual(['12а', '305', null])
  })

  it('круговой проход не меняет данные', () => {
    const src = [lesson(2, 'А'), { ...lesson(5, 'Б'), startsAt: '10:00', endsAt: '10:45' }]
    expect(toLessons(fromLessons(src))).toEqual(src)
  })

  it('ключи строк уникальны', () => {
    expect(newLesson().key).not.toBe(newLesson().key)
  })

  it('hasInvalidTime: конец не позже начала — ошибка, у пустой строки не проверяется', () => {
    const days = fromLessons([])
    days[1] = [{ ...newLesson(), subject: 'А', startsAt: '09:00', endsAt: '09:00' }]
    expect(hasInvalidTime(days)).toBe(true)
    days[1] = [{ ...newLesson(), subject: 'А', startsAt: '09:00', endsAt: '09:45' }]
    expect(hasInvalidTime(days)).toBe(false)
    days[1] = [{ ...newLesson(), subject: '', startsAt: '09:00', endsAt: '08:00' }]
    expect(hasInvalidTime(days)).toBe(false)
  })

  it('defaultDay: в воскресенье понедельник', () => {
    expect(defaultDay(at(SUN))).toBe(1)
    expect(defaultDay(at(FRI))).toBe(5)
  })
})

describe('расписание тренировок: черновик и сохранение', () => {
  it('круговой проход с местом и без', () => {
    const src = [
      { weekday: 7, title: 'Бег', place: 'Парк', startsAt: '09:00', endsAt: '10:00' },
      training(2),
    ]
    expect(toTrainings(fromTrainings(src))).toEqual([training(2), src[0]])
  })

  it('пустые названия отбрасываются, место обрезается до null', () => {
    const days = fromTrainings([])
    days[3] = [
      { ...newTraining(), title: ' ', place: 'Зал' },
      { ...newTraining(), title: 'Йога', place: '  ' },
    ]
    expect(toTrainings(days)).toEqual([{ weekday: 3, title: 'Йога', place: null, startsAt: null, endsAt: null }])
  })

  it('воскресенье (7) поддерживается', () => {
    expect(fromTrainings([training(7)])[7]).toHaveLength(1)
    expect(defaultTrainingDay(at(SUN))).toBe(7)
  })

  it('trainingInvalidTime', () => {
    const days = fromTrainings([])
    days[1] = [{ ...newTraining(), title: 'А', startsAt: '19:00', endsAt: '18:00' }]
    expect(trainingInvalidTime(days)).toBe(true)
  })
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

  it('вечером переходит на завтра', () => {
    expect(pickTrainingDay(at(MON, 18), [training(1), training(2)])).toMatchObject({ weekday: 2, label: 'завтра' })
  })

  it('ближайший день с тренировками получает название дня недели', () => {
    expect(pickTrainingDay(at(MON, 10), [training(3)])).toMatchObject({ weekday: 3, label: 'в среду' })
  })

  it('переход через воскресенье', () => {
    expect(pickTrainingDay(at(SAT, 10), [training(1)])).toMatchObject({ weekday: 1, label: 'в понедельник' })
    expect(pickTrainingDay(at(SUN, 10), [training(7)])).toMatchObject({ weekday: 7, label: 'сегодня' })
  })

  it('единственная тренировка в тот же день недели вечером — «через неделю»', () => {
    expect(pickTrainingDay(at(MON, 19), [training(1)])).toMatchObject({ weekday: 1, label: 'через неделю' })
  })

  it('без тренировок null', () => {
    expect(pickTrainingDay(at(MON, 10), [])).toBeNull()
  })

  it('trainingSummary', () => {
    const day = pickTrainingDay(at(MON, 10), [training(1, 'Плавание', '18:00'), training(1, 'Растяжка')])!
    expect(trainingSummary(day)).toBe('Плавание 18:00 · Растяжка')
  })
})
