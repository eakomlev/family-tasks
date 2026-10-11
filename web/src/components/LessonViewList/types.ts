export interface ViewLesson {
  // для React key
  key: string
  subject: string
  startsAt?: string | null
  endsAt?: string | null
}

export interface LessonViewListProps {
  lessons: ViewLesson[]
  // если задан, каждый урок это ссылка (например, на страницу «Что ты хочешь сообщить!»)
  getLink?: (lesson: ViewLesson) => string
}
