import { useMemo } from 'react'
import { View } from 'react-native'
import { Input } from '@/components/Input'
import { TrainingList } from '@/features/myDay/ScheduleLists'
import { useIdentity } from '@/identity/context'
import { WEEK_DAYS } from '@/lib/weekdays'
import { toApiError } from '@/store/api'
import { useGetTrainingsQuery, useSaveTrainingsMutation } from '@/store/schedules'
import { ScheduleEditor, type ScheduleKind } from './ScheduleEditor'
import { defaultDay, fromTrainings, hasInvalidTime, MAX_TRAININGS_PER_DAY, newTraining, toTrainings } from './trainingsDraft'
import type { TrainingDraft } from './trainingsTypes'
import { TimeRangeFields } from './TimeRangeFields'

const kind: ScheduleKind<TrainingDraft> = {
  title: 'Расписание тренировок',
  unit: 'тренировок',
  days: WEEK_DAYS,
  max: MAX_TRAININGS_PER_DAY,
  itemLabel: 'Тренировка',
  emptyAction: 'Составить расписание',
  noDayText: 'В этот день тренировок нет.',
  noScheduleText: 'Расписание пока не составлено.',
  newRow: newTraining,
  serialize: toTrainings,
  hasInvalidTime,
  defaultDay,
  renderFields: (training, change, label) => (
    <View style={{ gap: 8 }}>
      <Input value={training.title} onChangeText={(title) => change({ title })} maxLength={60} placeholder="Название, например плавание" accessibilityLabel={`${label}: название`} />
      <Input value={training.place} onChangeText={(place) => change({ place })} maxLength={60} placeholder="Где (необязательно)" accessibilityLabel={`${label}: место`} />
      <TimeRangeFields startsAt={training.startsAt} endsAt={training.endsAt} label={label} onChange={change} />
    </View>
  ),
  renderView: (rows) => (
    <TrainingList trainings={rows.map((t) => ({ key: t.key, title: t.title, place: t.place || null, startsAt: t.startsAt || null, endsAt: t.endsAt || null }))} />
  ),
}

// Расписание тренировок ребёнка: ребёнок правит своё, родитель правит расписание ребёнка (memberId)
export function TrainingsScreen({ memberId: paramId }: { memberId?: string }) {
  const { identity } = useIdentity()
  const memberId = paramId ?? identity?.memberId
  const query = useGetTrainingsQuery(memberId ?? '', { skip: !memberId })
  const saved = useMemo(() => (query.data ? fromTrainings(query.data.trainings) : undefined), [query.data])
  const [saveTrainings] = useSaveTrainingsMutation()

  return (
    <ScheduleEditor
      kind={kind}
      memberId={paramId}
      saved={saved}
      loadFailed={query.isError && !query.data}
      onSave={async (id, days) => {
        await saveTrainings({ memberId: id, trainings: toTrainings(days) }).unwrap().catch(toApiError)
      }}
    />
  )
}
