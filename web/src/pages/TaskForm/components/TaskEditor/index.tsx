import { useState, type FormEvent } from 'react'
import { ApiError, type RepeatType } from '@/api'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Select } from '@/components/Select'
import { Stack } from '@/components/Stack'
import { isoWeekdayOf, todayIso } from '@/lib/date'
import type { FormState } from '../../types'
import { toInput, validate } from '../../utils'
import { RepeatFields } from '../RepeatFields'
import type { TaskEditorProps } from './types'

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'forbidden') return 'Изменять задание может только тот, кто его создал.'
    if (err.code === 'task_not_found') return 'Задание не найдено: возможно, его уже удалили.'
    if (err.code === 'assignee_not_found') return 'Исполнитель не найден в семье.'
  }
  return 'Не удалось сохранить задание. Попробуйте ещё раз.'
}

export function TaskEditor({ initial, members, me, submitLabel, onSubmit, onDelete }: TaskEditorProps) {
  const [form, setForm] = useState<FormState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }))
    setError(undefined)
  }

  // без даты нет ни времени, ни повтора
  function changeDate(date: string) {
    if (date === '') patch({ date, time: '', repeatType: 'none', days: [], until: '' })
    else patch({ date })
  }

  // выбор повтора подставляет сегодняшнюю дату, если её не указали, и день недели по умолчанию
  function changeRepeat(type: RepeatType) {
    const date = form.date || todayIso()
    patch({
      repeatType: type,
      date,
      days: type === 'weekly' ? (form.days.length ? form.days : [isoWeekdayOf(date)]) : [],
      until: type === 'none' ? '' : form.until,
    })
  }

  const toggleDay = (day: number) =>
    patch({ days: form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day].sort((a, b) => a - b) })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validate(form)
    if (problem) return setError(problem)
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit(toInput(form))
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || !window.confirm('Удалить задание? Это действие нельзя отменить.')) return
    setBusy(true)
    setError(undefined)
    try {
      await onDelete()
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <Field label="Название">
        <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={100} placeholder="Например, вынести мусор" autoFocus={!onDelete} />
      </Field>

      <Field label="Кому">
        <Select value={form.assigneeId} onChange={(e) => patch({ assigneeId: e.target.value })}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (я)` : m.name}</option>)}
        </Select>
      </Field>

      <Field label="Дата" hint="Без даты задание будет «без срока».">
        <Input type="date" value={form.date} onChange={(e) => changeDate(e.target.value)} />
      </Field>
      {form.date && (
        <Button $variant="text" type="button" onClick={() => changeDate('')}>Убрать дату</Button>
      )}

      <Field label="Время">
        <Input type="time" value={form.time} disabled={!form.date} onChange={(e) => patch({ time: e.target.value })} />
      </Field>

      <RepeatFields
        disabled={false}
        repeatType={form.repeatType}
        days={form.days}
        until={form.until}
        min={form.date}
        onTypeChange={changeRepeat}
        onToggleDay={toggleDay}
        onUntilChange={(until) => patch({ until })}
      />

      {error && <Notice $tone="error">{error}</Notice>}
      <Button $variant="primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : submitLabel}</Button>
      {onDelete && <Button $variant="danger" type="button" disabled={busy} onClick={handleDelete}>Удалить задание</Button>}
    </Stack>
  )
}
