export interface ViewLesson {
  // для React key
  key: string
  subject: string
  startsAt?: string | null
  endsAt?: string | null
}

export interface LessonViewListProps {
  lessons: ViewLesson[]
}
