export interface TodayLessonsProps {
  // текущее время страницы: по нему выбирается день
  now: Date
}

export interface LessonDay {
  // 1 = понедельник ... 6 = суббота
  weekday: number
  // «сегодня», «завтра» или «в понедельник»
  label: string
}
