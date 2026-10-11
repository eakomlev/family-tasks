import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ApiError, getTrainings, saveTrainings } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { DayTabs } from '@/components/DayTabs'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { SortableList } from '@/components/SortableList'
import { Stack } from '@/components/Stack'
import { TrainingViewList } from '@/components/TrainingViewList'
import { useIdentity } from '@/identity/context'
import { WEEK_DAYS } from '@/lib/weekdays'
import { useProfile } from '@/profile/context'
import { TrainingRow } from './components/TrainingRow'
import { Subtitle } from './styles'
import type { Days, TrainingDraft } from './types'
import {
  defaultDay,
  fromTrainings,
  hasInvalidTime,
  MAX_TRAININGS_PER_DAY,
  newTraining,
  toTrainings,
} from './utils'

// Один редактор для двух случаев: ребёнок правит своё (/settings/trainings),
// родитель правит расписание ребёнка (/family/:memberId/trainings).
export default function Trainings() {
  const { memberId: paramId } = useParams()
  const { identity } = useIdentity()
  const confirm = useConfirm()
  const { data } = useProfile()

  // saved — то, что лежит на сервере; draft — правки в режиме редактирования
  const [saved, setSaved] = useState<Days>()
  const [draft, setDraft] = useState<Days>()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [day, setDay] = useState(defaultDay)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [justSaved, setJustSaved] = useState(false)

  const isChild = identity?.role === 'child'
  const memberId = paramId ?? identity?.memberId
  const token = identity?.token
  const isOwn = memberId === identity?.memberId
  const target = data?.members.find((m) => m.id === memberId)
  // чужое расписание открывают только родители и только расписание ребёнка из своей семьи;
  // пока список семьи не загружен, участника проверить нельзя, поэтому пропускаем (сервер проверит сам)
  const allowed = isOwn ? isChild : !isChild && (!data || target?.role === 'child')

  useEffect(() => {
    if (!token || !memberId || !allowed) return
    let cancelled = false
    getTrainings(token, memberId)
      .then((res) => !cancelled && setSaved(fromTrainings(res.trainings)))
      .catch(() => !cancelled && setLoadFailed(true))
    return () => { cancelled = true }
  }, [token, memberId, allowed])

  if (!identity || !memberId || !allowed) {
    return <Navigate to={isChild ? '/settings' : '/family'} replace />
  }

  const editing = mode === 'edit'
  const days = editing ? draft : saved
  const dayTrainings = days?.[day] ?? []
  const counts = Object.fromEntries(WEEK_DAYS.map((d) => [d.value, days?.[d.value]?.length ?? 0]))
  const hasAnyTrainings = Object.values(saved ?? {}).some((list) => list.length > 0)

  // есть ли несохранённые правки: сравниваем то, что реально уйдёт на сервер
  const isDirty = !!draft && !!saved && JSON.stringify(toTrainings(draft)) !== JSON.stringify(toTrainings(saved))

  function startEditing() {
    if (!saved) return
    setDraft(saved)
    setError(undefined)
    setJustSaved(false)
    setMode('edit')
  }

  async function cancelEditing() {
    if (isDirty && !(await confirm({ title: 'Отменить изменения?', message: 'Несохранённые правки пропадут.', confirmLabel: 'Отменить изменения', cancelLabel: 'Продолжить редактирование', danger: true }))) return
    setDraft(undefined)
    setError(undefined)
    setMode('view')
  }

  function editDay(update: (list: TrainingDraft[]) => TrainingDraft[]) {
    setDraft((current) => current && { ...current, [day]: update(current[day] ?? []) })
    setError(undefined)
  }

  async function handleSave() {
    if (!draft || !token || !memberId) return
    if (hasInvalidTime(draft)) {
      setError('У некоторых тренировок время окончания раньше начала или совпадает с ним.')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const trainings = toTrainings(draft)
      await saveTrainings(token, memberId, trainings)
      // пустые строки при сохранении отбрасываются, поэтому показываем ровно то, что ушло на сервер
      setSaved(fromTrainings(trainings))
      setDraft(undefined)
      setJustSaved(true)
      setMode('view')
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_time'
          ? 'У некоторых тренировок время окончания раньше начала.'
          : 'Не удалось сохранить тренировки. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to={isOwn ? '/settings' : `/family/${memberId}`}>← Назад</BackLink>
      <h1>Расписание тренировок</h1>
      {!isOwn && target && <Subtitle>{target.name}</Subtitle>}

      {loadFailed && <Notice $tone="error">Не удалось загрузить расписание тренировок. Проверьте соединение.</Notice>}
      {!saved && !loadFailed && <p>Загрузка…</p>}

      {days && (
        <Stack>
          <DayTabs days={WEEK_DAYS} selected={day} counts={counts} unit="тренировок" onSelect={setDay} />

          <h2>{WEEK_DAYS.find((d) => d.value === day)?.full}</h2>

          {editing ? (
            <>
              {dayTrainings.length === 0 && <Notice $tone="muted">В этот день тренировок нет. Добавьте первую.</Notice>}
              <Notice $tone="muted">
                Если указать время начала, ребёнку придёт напоминание за 2 часа (уведомления включаются в «Настройках»).
              </Notice>
              <SortableList items={dayTrainings} onReorder={(trainings) => editDay(() => trainings)}>
                {dayTrainings.map((training, index) => (
                  <TrainingRow
                    key={training.key}
                    index={index}
                    training={training}
                    onChange={(patch) =>
                      editDay((list) => list.map((t) => (t.key === training.key ? { ...t, ...patch } : t)))
                    }
                    onRemove={() => editDay((list) => list.filter((t) => t.key !== training.key))}
                  />
                ))}
              </SortableList>

              <Button
                type="button"
                disabled={dayTrainings.length >= MAX_TRAININGS_PER_DAY}
                onClick={() => editDay((list) => [...list, newTraining()])}
              >
                + Добавить тренировку
              </Button>

              {error && <Notice $tone="error">{error}</Notice>}
              <Button $variant="primary" type="button" disabled={saving} onClick={handleSave}>
                {saving ? 'Сохраняем…' : 'Сохранить расписание'}
              </Button>
              <Button type="button" disabled={saving} onClick={cancelEditing}>Отмена</Button>
            </>
          ) : (
            <>
              {dayTrainings.length === 0 && (
                <Notice $tone="muted">
                  {hasAnyTrainings ? 'В этот день тренировок нет.' : 'Расписание тренировок пока не составлено.'}
                </Notice>
              )}
              <TrainingViewList trainings={dayTrainings} />
              {justSaved && <Notice $tone="muted">Расписание тренировок сохранено.</Notice>}
              <Button $variant="primary" type="button" onClick={startEditing}>
                {hasAnyTrainings ? 'Изменить' : 'Составить расписание'}
              </Button>
            </>
          )}
        </Stack>
      )}
    </Page>
  )
}
