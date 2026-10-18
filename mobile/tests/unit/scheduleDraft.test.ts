import { describe, expect, it } from 'vitest'
import { defaultDay, fromLessons, hasInvalidTime, newLesson, toLessons } from '@/features/schedule/lessonsDraft'
import {
  defaultDay as defaultTrainingDay,
  fromTrainings,
  hasInvalidTime as trainingInvalidTime,
  newTraining,
  toTrainings,
} from '@/features/schedule/trainingsDraft'

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

