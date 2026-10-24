import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { DayTabs } from '@/components/DayTabs'
import { LessonViewList } from '@/components/LessonViewList'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { SortableList } from '@/components/SortableList'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { isAdult, isParent } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useGetScheduleQuery, useSaveScheduleMutation } from '@/store/schedules'
import { LessonRow } from './components/LessonRow'
import { Subtitle } from './styles'
import type { Days, LessonDraft } from './types'
import {
  defaultDay,
  fromLessons,
  hasInvalidTime,
  MAX_LESSONS_PER_DAY,
  newLesson,
  toLessons,
  WEEKDAYS,
} from './utils'
import { useInFlight } from '@/lib/useInFlight'

// Один редактор для двух случаев: ребёнок правит своё (/profile/schedule),
// родитель правит расписание ребёнка (/family/:memberId/schedule).
export default function Schedule() {
  const guard = useInFlight()
  const { memberId: paramId } = useParams()
  const { identity } = useIdentity()
  const confirm = useConfirm()
  const { data } = useProfile()

  // saved — то, что лежит на сервере; draft — правки в режиме редактирования
  const [draft, setDraft] = useState<Days>()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [day, setDay] = useState(defaultDay)
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
  // бабушка и дедушка расписание только смотрят, менять могут сам ребёнок и родители
  const canEdit = isOwn || isParent(identity?.role)
  const allowed = isOwn ? isChild : isAdult(identity?.role) && (!data || target?.role === 'child')

  // серверное состояние из кэша (сохранённое на устройстве видно сразу, свежее приходит следом); чужие правки приходят по сокету
  // через инвалидацию кэша, черновик при этом не трогаем
  const query = useGetScheduleQuery(memberId ?? '', { skip: !memberId || !allowed })
  const saved = useMemo<Days | undefined>(() => (query.data ? fromLessons(query.data.lessons) : undefined), [query.data])
  const loadFailed = query.isError && !query.data
  const [saveSchedule] = useSaveScheduleMutation()

  if (!identity || !memberId || !allowed) {
    return <Navigate to={isChild ? '/profile' : '/family'} replace />
  }

  const editing = mode === 'edit'
  const days = editing ? draft : saved
  const dayLessons = days?.[day] ?? []
  const counts = Object.fromEntries(WEEKDAYS.map((d) => [d.value, days?.[d.value]?.length ?? 0]))
  const hasAnyLessons = Object.values(saved ?? {}).some((list) => list.length > 0)

  // есть ли несохранённые правки: сравниваем то, что реально уйдёт на сервер
  const isDirty = !!draft && !!saved && JSON.stringify(toLessons(draft)) !== JSON.stringify(toLessons(saved))

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

  function editDay(update: (list: LessonDraft[]) => LessonDraft[]) {
    setDraft((current) => current && { ...current, [day]: update(current[day] ?? []) })
    setError(undefined)
  }

  const handleSave = guard(async () => {
    if (!draft || !token || !memberId) return
    if (hasInvalidTime(draft)) {
      setError('У некоторых уроков время окончания раньше начала или совпадает с ним.')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const lessons = toLessons(draft)
      // кэш обновляется сразу тем, что ушло на сервер (пустые строки при сохранении отбрасываются), при ошибке откатывается
      await saveSchedule({ memberId, lessons }).unwrap().catch(toApiError)
      setDraft(undefined)
      setJustSaved(true)
      setMode('view')
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_time'
          ? 'У некоторых уроков время окончания раньше начала.'
          : 'Не удалось сохранить расписание. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  })

  return (
    <Page>
      <PageHeader to={isOwn ? '/profile' : `/family/${memberId}`}>Расписание уроков</PageHeader>
      {!isOwn && target && <Subtitle>{target.name}</Subtitle>}

      {loadFailed && <Notice $tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!saved && !loadFailed && <p>Загрузка…</p>}

      {days && (
        <Stack>
          <DayTabs days={WEEKDAYS} selected={day} counts={counts} unit="уроков" onSelect={setDay} />

          <h2>{WEEKDAYS.find((d) => d.value === day)?.full}</h2>

          {editing ? (
            <>
              {dayLessons.length === 0 && <Notice $tone="muted">В этот день уроков нет. Добавьте первый.</Notice>}
              <SortableList items={dayLessons} onReorder={(lessons) => editDay(() => lessons)}>
                {dayLessons.map((lesson, index) => (
                  <LessonRow
                    key={lesson.key}
                    index={index}
                    lesson={lesson}
                    onChange={(patch) =>
                      editDay((list) => list.map((l) => (l.key === lesson.key ? { ...l, ...patch } : l)))
                    }
                    onRemove={() => editDay((list) => list.filter((l) => l.key !== lesson.key))}
                  />
                ))}
              </SortableList>

              <Button
                type="button"
                disabled={dayLessons.length >= MAX_LESSONS_PER_DAY}
                onClick={() => editDay((list) => [...list, newLesson()])}
              >
                + Добавить урок
              </Button>

              {error && <Notice $tone="error">{error}</Notice>}
              <Button $variant="primary" type="button" disabled={saving} onClick={handleSave}>
                {saving ? 'Сохраняем…' : 'Сохранить расписание'}
              </Button>
              <Button type="button" disabled={saving} onClick={cancelEditing}>Отмена</Button>
            </>
          ) : (
            <>
              {dayLessons.length === 0 && (
                <Notice $tone="muted">
                  {hasAnyLessons ? 'В этот день уроков нет.' : 'Расписание пока не составлено.'}
                </Notice>
              )}
              <LessonViewList lessons={dayLessons} />
              {justSaved && <Notice $tone="muted">Расписание сохранено.</Notice>}
              {canEdit && (
                <Button $variant="primary" type="button" onClick={startEditing}>
                  {hasAnyLessons ? 'Изменить' : 'Составить расписание'}
                </Button>
              )}
            </>
          )}
        </Stack>
      )}
    </Page>
  )
}
