import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { Chip } from '@/components/Chip'
import { useConfirm } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCreateEventMutation, useDeleteEventMutation, useGetEventQuery, useUpdateEventMutation } from '@/store/events'
import { describeEventError } from './eventErrors'
import { emptyEventForm, fromEvent, toInput, validateEvent, withEnd, withStart, type EventFormState } from './eventForm'

const isIsoDate = (value?: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

// Создание (без id) и изменение своего события; date и view запоминают, куда вернуться в календаре
export function EventFormScreen({ id, date, view }: { id?: string; date?: string; view?: string }) {
  const router = useRouter()
  const guard = useInFlight()
  const confirm = useConfirm()
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()

  const event = useGetEventQuery(id ?? '', { skip: !identity || !id })
  const [createEvent] = useCreateEventMutation()
  const [updateEvent] = useUpdateEventMutation()
  const [deleteEvent] = useDeleteEventMutation()

  const [form, setForm] = useState<EventFormState>(() => emptyEventForm(isIsoDate(date) ? date : todayIso()))
  // форма заполняется данными события один раз: чужие правки по сокету не затирают ввод
  const [filledFor, setFilledFor] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (!identity) return null
  const stored = event.data?.event
  if (stored && filledFor !== stored.id) {
    setFilledFor(stored.id)
    setForm(fromEvent(stored, stored.authorId))
  }
  const back = { pathname: '/calendar' as const, params: { ...(view ? { view } : {}), ...(isIsoDate(date) ? { date } : {}) } }
  if (id && event.error && 'status' in event.error && event.error.status === 404) return <Redirect href="/calendar" />
  // изменять может только автор
  if (stored && stored.authorId !== identity.memberId) return <Redirect href={{ pathname: '/calendar/events/[id]', params: { id: stored.id } }} />

  const others = (profile?.members ?? []).filter((m) => m.id !== identity.memberId)
  const patch = (change: Partial<EventFormState>) => {
    setForm((current) => ({ ...current, ...change }))
    setError(undefined)
  }
  const toggle = (memberId: string) => patch({ memberIds: form.memberIds.includes(memberId) ? form.memberIds.filter((x) => x !== memberId) : [...form.memberIds, memberId] })

  const save = guard(async () => {
    const problem = validateEvent(form)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      if (id) await updateEvent({ id, input: toInput(form) }).unwrap().catch(toApiError)
      else await createEvent(toInput(form)).unwrap().catch(toApiError)
      router.replace({ pathname: '/calendar', params: { ...(view ? { view } : {}), date: form.startDate } })
    } catch (err) {
      setError(describeEventError(err))
      setBusy(false)
    }
  })

  const remove = guard(async () => {
    if (!id) return
    if (!(await confirm({ title: 'Удалить событие?', message: 'Событие пропадёт у всех участников.', confirmLabel: 'Удалить', danger: true }))) return
    setBusy(true)
    try {
      await deleteEvent(id).unwrap().catch(toApiError)
      router.replace('/calendar')
    } catch (err) {
      setError(describeEventError(err))
      setBusy(false)
    }
  })

  const loading = !!id && !stored && !event.error

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback={id ? { pathname: '/calendar/events/[id]', params: { id } } : back}>{id ? '← Событие' : '← Календарь'}</BackLink>
      <Title>{id ? 'Изменить событие' : 'Новое событие'}</Title>
      {loading && <Text $tone="muted">Загрузка…</Text>}
      {!loading && (
        <Stack>
          <Field label="Название">
            <Input value={form.title} maxLength={100} placeholder="Например, поход в театр" onChangeText={(title) => patch({ title })} />
          </Field>

          <Checkbox checked={form.allDay} onChange={(allDay) => patch({ allDay })}>
            Весь день
          </Checkbox>

          <Field label="Начало">
            <DateTimeField mode="date" value={form.startDate} onChange={(startDate) => setForm(withStart(form, { startDate }))} accessibilityLabel="Дата начала" />
            {!form.allDay && <DateTimeField mode="time" value={form.startTime} onChange={(startTime) => setForm(withStart(form, { startTime }))} accessibilityLabel="Время начала" />}
          </Field>

          <Field label="Конец">
            <DateTimeField mode="date" value={form.endDate} min={form.startDate} onChange={(endDate) => setForm(withEnd(form, { endDate }))} accessibilityLabel="Дата окончания" />
            {!form.allDay && <DateTimeField mode="time" value={form.endTime} onChange={(endTime) => setForm(withEnd(form, { endTime }))} accessibilityLabel="Время окончания" />}
          </Field>

          <Field label="Кто видит и участвует">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip active={form.allFamily} onPress={() => patch({ allFamily: true })}>
                Вся семья
              </Chip>
              <Chip active={!form.allFamily} onPress={() => patch({ allFamily: false })}>
                Выбрать
              </Chip>
            </View>
          </Field>
          {!form.allFamily && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: colors.accent }} accessibilityLabel="Вы участвуете всегда">
                  <Avatar name={profile?.me.name ?? identity.name} seed={identity.memberId} src={profile?.me.avatar} size={26} />
                  <Text $weight="bold" $size={14}>
                    Вы
                  </Text>
                </View>
                {others.map((member) => {
                  const on = form.memberIds.includes(member.id)
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggle(member.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }}
                    >
                      <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size={26} />
                      <Text $weight="bold" $size={14}>
                        {memberLabel(member, identity.role)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Notice>{form.memberIds.length === 0 ? 'Событие увидите только вы.' : 'Событие увидят только выбранные участники и вы.'}</Notice>
            </>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="primary" disabled={busy} onPress={save}>
            {id ? 'Сохранить' : 'Создать событие'}
          </Button>
          {id && (
            <Button variant="danger" disabled={busy} onPress={remove}>
              Удалить событие
            </Button>
          )}
        </Stack>
      )}
    </Screen>
  )
}
