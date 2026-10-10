import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ApiError, getSchedule, saveSchedule } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { DayTabs } from './components/DayTabs'
import { LessonList } from './components/LessonList'
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

// Один редактор для двух случаев: ребёнок правит своё (/settings/schedule),
// родитель правит расписание ребёнка (/family/:memberId/schedule).
export default function Schedule() {
  const { memberId: paramId } = useParams()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const [days, setDays] = useState<Days>()
  const [day, setDay] = useState(defaultDay)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

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
    getSchedule(token, memberId)
      .then((res) => !cancelled && setDays(fromLessons(res.lessons)))
      .catch(() => !cancelled && setLoadFailed(true))
    return () => { cancelled = true }
  }, [token, memberId, allowed])

  if (!identity || !memberId || !allowed) {
    return <Navigate to={isChild ? '/settings' : '/family'} replace />
  }

  const dayLessons = days?.[day] ?? []
  const counts = Object.fromEntries(WEEKDAYS.map((d) => [d.value, days?.[d.value]?.length ?? 0]))

  function editDay(update: (list: LessonDraft[]) => LessonDraft[]) {
    setDays((current) => current && { ...current, [day]: update(current[day] ?? []) })
    setSaved(false)
    setError(undefined)
  }

  async function handleSave() {
    if (!days || !token || !memberId) return
    if (hasInvalidTime(days)) {
      setError('У некоторых уроков время окончания раньше начала или совпадает с ним.')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const lessons = toLessons(days)
      await saveSchedule(token, memberId, lessons)
      // пустые строки при сохранении отбрасываются, поэтому перечитываем состояние из того, что ушло на сервер
      setDays(fromLessons(lessons))
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_time'
          ? 'У некоторых уроков время окончания раньше начала.'
          : 'Не удалось сохранить расписание. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <BackLink to={isOwn ? '/settings' : `/family/${memberId}`}>← Назад</BackLink>
      <h1>Расписание уроков</h1>
      {!isOwn && target && <Subtitle>{target.name}</Subtitle>}

      {loadFailed && <Notice $tone="error">Не удалось загрузить расписание. Проверьте соединение.</Notice>}
      {!days && !loadFailed && <p>Загрузка…</p>}

      {days && (
        <Stack>
          <DayTabs selected={day} counts={counts} onSelect={setDay} />

          <h2>{WEEKDAYS.find((d) => d.value === day)?.full}</h2>
          {dayLessons.length === 0 && <Notice $tone="muted">В этот день уроков нет. Добавьте первый.</Notice>}
          <LessonList
            lessons={dayLessons}
            onChange={(key, patch) =>
              editDay((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)))
            }
            onRemove={(key) => editDay((list) => list.filter((l) => l.key !== key))}
            onReorder={(lessons) => editDay(() => lessons)}
          />

          <Button
            type="button"
            disabled={dayLessons.length >= MAX_LESSONS_PER_DAY}
            onClick={() => editDay((list) => [...list, newLesson()])}
          >
            + Добавить урок
          </Button>

          {error && <Notice $tone="error">{error}</Notice>}
          {saved && <Notice $tone="muted">Расписание сохранено.</Notice>}
          <Button $variant="primary" type="button" disabled={saving} onClick={handleSave}>
            {saving ? 'Сохраняем…' : 'Сохранить расписание'}
          </Button>
        </Stack>
      )}
    </Page>
  )
}
