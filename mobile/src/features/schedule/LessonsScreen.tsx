import { useMemo } from 'react'
import { Input } from '@/components/Input'
import { View } from 'react-native'
import { useIdentity } from '@/identity/context'
import { toApiError } from '@/store/api'
import { useGetScheduleQuery, useSaveScheduleMutation } from '@/store/schedules'
import { LessonList } from '@/features/myDay/ScheduleLists'
import { ScheduleEditor, type ScheduleKind } from './ScheduleEditor'
import { defaultDay, fromLessons, hasInvalidTime, MAX_LESSONS_PER_DAY, newLesson, toLessons, WEEKDAYS } from './lessonsDraft'
import type { LessonDraft } from './lessonsTypes'
import { TimeRangeFields } from './TimeRangeFields'

const kind: ScheduleKind<LessonDraft> = {
  title: 'Расписание уроков',
  unit: 'уроков',
  days: WEEKDAYS,
  max: MAX_LESSONS_PER_DAY,
  itemLabel: 'Урок',
  emptyAction: 'Составить расписание',
  noDayText: 'В этот день уроков нет.',
  noScheduleText: 'Расписание пока не составлено.',
  newRow: newLesson,
  serialize: toLessons,
  hasInvalidTime,
  defaultDay,
  renderFields: (lesson, change, label) => (
    <View style={{ gap: 8 }}>
      <Input value={lesson.subject} onChangeText={(subject) => change({ subject })} maxLength={60} placeholder="Предмет" accessibilityLabel={`${label}: предмет`} />
      <TimeRangeFields startsAt={lesson.startsAt} endsAt={lesson.endsAt} label={label} onChange={change} />
      <Input value={lesson.room} onChangeText={(room) => change({ room })} maxLength={12} placeholder="Кабинет (необязательно)" accessibilityLabel={`${label}: кабинет`} />
    </View>
  ),
  renderView: (rows) => (
    <LessonList lessons={rows.map((l) => ({ key: l.key, subject: l.subject, startsAt: l.startsAt || null, endsAt: l.endsAt || null, room: l.room || null }))} />
  ),
}

// Расписание уроков ребёнка: ребёнок правит своё, родитель правит расписание ребёнка (memberId)
export function LessonsScreen({ memberId: paramId }: { memberId?: string }) {
  const { identity } = useIdentity()
  const memberId = paramId ?? identity?.memberId
  const query = useGetScheduleQuery(memberId ?? '', { skip: !memberId })
  const saved = useMemo(() => (query.data ? fromLessons(query.data.lessons) : undefined), [query.data])
  const [saveSchedule] = useSaveScheduleMutation()

  return (
    <ScheduleEditor
      kind={kind}
      memberId={paramId}
      saved={saved}
      loadFailed={query.isError && !query.data}
      // кэш обновляется сразу тем, что ушло на сервер (пустые строки при сохранении отбрасываются), при ошибке откатывается
      onSave={async (id, days) => {
        await saveSchedule({ memberId: id, lessons: toLessons(days) }).unwrap().catch(toApiError)
      }}
    />
  )
}
