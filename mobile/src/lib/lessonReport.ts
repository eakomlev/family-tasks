// Оценки, которые ребёнок может сообщить об уроке (российская пятибалльная шкала).
export const GRADES = [5, 4, 3, 2]

export const MAX_COMMENT = 500

// Сообщение в общий чат из выбора на странице «Что ты хочешь сообщить!»:
//   Урок «Математика»: оценка 5
//   Сдал контрольную
// Нужна оценка или комментарий; без обоих сообщения нет (null).
export function buildLessonReport(subject: string, grade: number | null, comment: string): string | null {
  const text = comment.trim()
  if (grade === null && text === '') return null
  const head = `Урок «${subject.trim()}»${grade === null ? '' : `: оценка ${grade}`}`
  return text === '' ? head : `${head}\n${text}`
}
