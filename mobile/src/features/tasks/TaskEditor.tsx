import { useState } from 'react'
import { View } from 'react-native'
import { ApiError, type Member, type RepeatType, type TaskInput } from '@/api'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { Chip } from '@/components/Chip'
import { CoinPicker } from '@/components/CoinPicker'
import { useConfirm } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { isoWeekdayOf, todayIso } from '@/lib/date'
import { isParent } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { WEEK_DAYS } from '@/lib/weekdays'
import type { FormState } from './formTypes'
import { toInput, validate } from './formUtils'

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'По дням недели' },
  { value: 'monthly', label: 'Раз в месяц' },
]

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'forbidden') return 'Изменять задание может только тот, кто его создал.'
    if (err.code === 'task_not_found') return 'Задание не найдено: возможно, его уже удалили.'
    if (err.code === 'assignee_not_found') return 'Исполнитель не найден в семье.'
  }
  return 'Не удалось сохранить задание. Попробуйте ещё раз.'
}

interface TaskEditorProps {
  initial: FormState
  members: Member[]
  me: string
  submitLabel: string
  // должны бросить ошибку, если сервер отклонил запрос
  onSubmit: (input: TaskInput) => Promise<void>
  onDelete?: () => Promise<void>
}

// Форма задания: создание и изменение
export function TaskEditor({ initial, members, me, submitLabel, onSubmit, onDelete }: TaskEditorProps) {
  const guard = useInFlight()
  const confirm = useConfirm()
  const [form, setForm] = useState<FormState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const assigneeIsChild = members.find((m) => m.id === form.assigneeId)?.role === 'child'
  // награду назначают только родители (мама, папа): ребёнок, бабушка и дедушка не могут выдать монеты
  const meIsParent = isParent(members.find((m) => m.id === me)?.role)
  const canReward = assigneeIsChild && meIsParent

  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }))
    setError(undefined)
  }

  // у взрослого монет нет: при смене исполнителя награда сбрасывается
  function changeAssignee(assigneeId: string) {
    const child = members.find((m) => m.id === assigneeId)?.role === 'child'
    patch(child ? { assigneeId } : { assigneeId, reward: '0', rewardCustom: false })
  }

  // «Указать время»: включение ставит сегодняшнюю дату, выключение убирает дату, время и повтор (задание «без срока»)
  function toggleScheduled(on: boolean) {
    if (on) patch({ scheduled: true, date: form.date || todayIso() })
    else patch({ scheduled: false, date: '', time: '', repeatType: 'none', days: [], until: '' })
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

  const handleSubmit = guard(async () => {
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
  })

  const handleDelete = guard(async () => {
    if (!onDelete) return
    const ok = await confirm({ title: 'Удалить задание?', message: 'Это действие нельзя отменить.', confirmLabel: 'Удалить', danger: true })
    if (!ok) return
    setBusy(true)
    setError(undefined)
    try {
      await onDelete()
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  })

  return (
    <Stack>
      <Field label="Название">
        <Input value={form.title} onChangeText={(title) => patch({ title })} maxLength={100} placeholder="Например, вынести мусор" />
      </Field>

      <Field label="Описание" hint="Необязательно: подробности, что и как сделать.">
        <Input
          value={form.description}
          onChangeText={(description) => patch({ description })}
          maxLength={1000}
          multiline
          numberOfLines={3}
          style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }}
        />
      </Field>

      <Field label="Кому">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {members.map((m) => (
            <Chip key={m.id} active={form.assigneeId === m.id} onPress={() => changeAssignee(m.id)}>
              {m.id === me ? `${m.name} (я)` : m.name}
            </Chip>
          ))}
        </View>
      </Field>

      {/* монеты только за задания детей */}
      {canReward && <CoinPicker value={form.reward} custom={form.rewardCustom} onChange={(reward, rewardCustom) => patch({ reward, rewardCustom })} />}

      <Checkbox checked={form.scheduled} onChange={toggleScheduled}>
        Указать время
      </Checkbox>

      {form.scheduled && (
        <>
          <Field label="Дата">
            <DateTimeField mode="date" value={form.date} onChange={(date) => patch({ date })} accessibilityLabel="Дата" />
          </Field>

          <Field label="Время" hint="Необязательно: без времени задание на весь день.">
            <DateTimeField mode="time" value={form.time} onChange={(time) => patch({ time })} accessibilityLabel="Время" />
            {form.time !== '' && (
              <Button variant="text" onPress={() => patch({ time: '' })}>
                Убрать время
              </Button>
            )}
          </Field>

          <Field label="Повтор">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REPEAT_OPTIONS.map((o) => (
                <Chip key={o.value} active={form.repeatType === o.value} onPress={() => changeRepeat(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </View>
          </Field>

          {form.repeatType === 'weekly' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityLabel="Дни недели">
              {WEEK_DAYS.map((d) => (
                <Chip key={d.value} active={form.days.includes(d.value)} onPress={() => toggleDay(d.value)}>
                  {d.short}
                </Chip>
              ))}
            </View>
          )}

          {form.repeatType !== 'none' && (
            <Field label="Повторять до" hint="Необязательно. Без даты повторяется без конца.">
              <DateTimeField mode="date" value={form.until} min={form.date} onChange={(until) => patch({ until })} accessibilityLabel="Повторять до" />
              {form.until !== '' && (
                <Button variant="text" onPress={() => patch({ until: '' })}>
                  Повторять без конца
                </Button>
              )}
            </Field>
          )}
        </>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="primary" disabled={busy} onPress={handleSubmit}>
        {busy ? 'Сохраняем…' : submitLabel}
      </Button>
      {onDelete && (
        <Button variant="danger" disabled={busy} onPress={handleDelete}>
          Удалить задание
        </Button>
      )}
    </Stack>
  )
}
