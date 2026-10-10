import { addDays, TRAINING_LEAD_MINUTES, TRAINING_WINDOW_MINUTES, type LocalTime } from './time.js'

export interface PushMessage {
  title: string
  body: string
  // куда ведёт нажатие на уведомление
  url: string
  // уведомления с одним tag заменяют друг друга
  tag: string
}

export interface MemberInfo {
  id: string
  name: string
  // YYYY-MM-DD или null
  birthDate: string | null
}

export interface LessonInfo {
  weekday: number
  subject: string
  startsAt: string | null
  endsAt: string | null
}

export interface TrainingInfo {
  // 1 = понедельник ... 7 = воскресенье
  weekday: number
  title: string
  place: string | null
  startsAt: string | null
}

export interface PlannedMessage {
  // ключ для журнала отправленного
  kind: string
  message: PushMessage
  // локальная дата, к которой относится уведомление (по умолчанию сегодняшняя): тренировка рано утром
  // анонсируется накануне вечером, а в журнале запись должна относиться ко дню самой тренировки
  day?: string
}

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

// «1 год», «2 года», «5 лет»
export function formatYears(age: number): string {
  const lastTwo = age % 100
  const last = age % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${age} лет`
  if (last === 1) return `${age} год`
  if (last >= 2 && last <= 4) return `${age} года`
  return `${age} лет`
}

// День рождения 29 февраля в невисокосный год отмечаем 28 февраля.
export function isBirthdayOn(birthDate: string, local: LocalTime): boolean {
  const [, month, day] = birthDate.split('-').map(Number)
  if (month === local.month && day === local.day) return true
  return month === 2 && day === 29 && !isLeapYear(local.year) && local.month === 2 && local.day === 28
}

// Именинника поздравляем отдельным текстом, остальным сообщаем о дне рождения.
export function birthdayMessages(recipientId: string, family: MemberInfo[], local: LocalTime): PlannedMessage[] {
  const result: PlannedMessage[] = []
  for (const member of family) {
    if (!member.birthDate || !isBirthdayOn(member.birthDate, local)) continue
    const age = local.year - Number(member.birthDate.slice(0, 4))
    // в год рождения поздравлять не с чем
    if (age <= 0) continue

    const kind = `birthday:${member.id}`
    result.push(
      member.id === recipientId
        ? {
            kind,
            message: {
              title: `С днём рождения, ${member.name}! 🎉`,
              body: 'Пусть этот день будет радостным!',
              url: '/profile',
              tag: kind,
            },
          }
        : {
            kind,
            message: {
              title: 'Сегодня день рождения 🎂',
              body: `${member.name}: исполняется ${formatYears(age)}`,
              url: `/family/${member.id}`,
              tag: kind,
            },
          },
    )
  }
  return result
}

const WEEKDAYS_ACCUSATIVE = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']

// Следующий учебный день: завтрашний, но воскресенье и суббота без уроков пропускаются (как на «Моём дне»).
export function nextSchoolDay(local: LocalTime, lessons: LessonInfo[]): { weekday: number; offset: number } {
  const hasLessons = (weekday: number) => lessons.some((l) => l.weekday === weekday)
  let offset = 1
  let weekday = (local.weekday + 1) % 7
  while (weekday === 0 || (weekday === 6 && !hasLessons(6))) {
    offset++
    weekday = (weekday + 1) % 7
  }
  return { weekday, offset }
}

// «08:30–10:10» от начала первого до конца последнего урока, если время указано
function timeRange(lessons: LessonInfo[]): string | undefined {
  const starts = lessons.map((l) => l.startsAt).filter((t): t is string => !!t)
  const ends = lessons.map((l) => l.endsAt).filter((t): t is string => !!t)
  if (starts.length === 0 || ends.length === 0) return undefined
  return `${starts.reduce((a, b) => (a < b ? a : b))}–${ends.reduce((a, b) => (a > b ? a : b))}`
}

// null, если в следующий учебный день уроков нет: тогда напоминать не о чем
export function lessonsMessage(lessons: LessonInfo[], local: LocalTime): PlannedMessage | null {
  const { weekday, offset } = nextSchoolDay(local, lessons)
  const dayLessons = lessons.filter((l) => l.weekday === weekday)
  if (dayLessons.length === 0) return null

  const subjects = dayLessons.map((l) => l.subject).join(', ')
  const range = timeRange(dayLessons)
  return {
    kind: 'lessons',
    message: {
      title: offset === 1 ? 'Завтра уроки' : `Уроки ${WEEKDAYS_ACCUSATIVE[weekday]}`,
      body: range ? `${subjects} · ${range}` : subjects,
      url: '/my-day',
      tag: 'lessons',
    },
  }
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// Напоминание за два часа до начала тренировки. Тренировки без времени начала не напоминаем.
// Смотрим сегодняшние тренировки и завтрашние: у тех, что начинаются сразу после полуночи,
// «за два часа» приходится ещё на сегодняшний вечер.
export function trainingMessages(trainings: TrainingInfo[], local: LocalTime): PlannedMessage[] {
  const nowMinutes = local.hour * 60 + local.minute
  const todayIso = local.weekday || 7
  const result: PlannedMessage[] = []

  for (const dayOffset of [0, 1]) {
    const weekday = ((todayIso - 1 + dayOffset) % 7) + 1
    for (const training of trainings) {
      if (training.weekday !== weekday || !training.startsAt) continue

      // момент начала в минутах от сегодняшней полуночи
      const remindAt = dayOffset * 1440 + minutesOf(training.startsAt) - TRAINING_LEAD_MINUTES
      if (nowMinutes < remindAt || nowMinutes >= remindAt + TRAINING_WINDOW_MINUTES) continue

      const kind = `training:${training.startsAt}:${training.title}`
      result.push({
        kind,
        day: addDays(local.date, dayOffset),
        message: {
          title: 'Через 2 часа тренировка',
          body: `${training.title} в ${training.startsAt}${training.place ? ` · ${training.place}` : ''}`,
          url: '/my-day',
          tag: kind,
        },
      })
    }
  }
  return result
}
