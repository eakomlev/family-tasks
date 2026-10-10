export interface Greeting {
  text: string
  icon: string
}

export interface LessonDay {
  // 1 = понедельник ... 6 = суббота
  weekday: number
  // «сегодня», «завтра» или «в понедельник»
  label: string
}
