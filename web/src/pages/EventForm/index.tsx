import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Chip } from '@/components/Chip'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { TimePicker } from '@/components/TimePicker'
import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { memberLabel } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCreateEventMutation, useDeleteEventMutation, useGetEventQuery, useUpdateEventMutation } from '@/store/events'
import { DateRow, Mode, Participants, People, PersonChip } from './styles'
import { emptyEventForm, fromEvent, toInput, validateEvent, withEnd, withStart, type EventFormState } from './utils'
import { describeEventError } from './errors'

const isIsoDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

// /calendar/events/new — создание; /calendar/events/:id/edit — изменение своего события
export default function EventForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const guard = useInFlight()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data: profile } = useProfile()

  const event = useGetEventQuery(id ?? '', { skip: !identity || !id })
  const [createEvent] = useCreateEventMutation()
  const [updateEvent] = useUpdateEventMutation()
  const [deleteEvent] = useDeleteEventMutation()

  const queryDate = params.get('date')
  const [form, setForm] = useState<EventFormState>(() => emptyEventForm(isIsoDate(queryDate) ? queryDate : todayIso()))
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
  const view = params.get('view')
  const back = `/calendar${view || isIsoDate(queryDate) ? `?${new URLSearchParams({ ...(view ? { view } : {}), ...(isIsoDate(queryDate) ? { date: queryDate } : {}) })}` : ''}`
  if (id && event.error && 'status' in event.error && event.error.status === 404) return <Navigate to="/calendar" replace />
  // изменять может только автор
  if (stored && stored.authorId !== identity.memberId) return <Navigate to={`/calendar/events/${stored.id}`} replace />

  const others = (profile?.members ?? []).filter((m) => m.id !== identity.memberId)
  const patch = (change: Partial<EventFormState>) => {
    setForm((current) => ({ ...current, ...change }))
    setError(undefined)
  }
  const toggle = (memberId: string) =>
    patch({ memberIds: form.memberIds.includes(memberId) ? form.memberIds.filter((x) => x !== memberId) : [...form.memberIds, memberId] })

  const save = guard(async (e?: FormEvent) => {
    e?.preventDefault()
    const problem = validateEvent(form)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      if (id) await updateEvent({ id, input: toInput(form) }).unwrap().catch(toApiError)
      else await createEvent(toInput(form)).unwrap().catch(toApiError)
      navigate(`/calendar?${new URLSearchParams({ ...(view ? { view } : {}), date: form.startDate })}`, { replace: true })
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
      navigate('/calendar', { replace: true })
    } catch (err) {
      setError(describeEventError(err))
      setBusy(false)
    }
  })

  const loading = !!id && !stored && !event.error

  return (
    <Page>
      <PageHeader to={id ? `/calendar/events/${id}` : back}>{id ? 'Изменить событие' : 'Новое событие'}</PageHeader>
      {loading && <p>Загрузка…</p>}
      {!loading && (
        <Stack as="form" onSubmit={save} noValidate>
          <Field label="Название">
            <Input value={form.title} maxLength={100} placeholder="Например, поход в театр" autoFocus={!id} onChange={(e) => patch({ title: e.target.value })} />
          </Field>

          <Checkbox checked={form.allDay} onChange={(e) => patch({ allDay: e.target.checked })}>
            Весь день
          </Checkbox>

          <DateRow>
            <Field label="Начало">
              <Input type="date" value={form.startDate} onChange={(e) => setForm(withStart(form, { startDate: e.target.value }))} />
            </Field>
            {!form.allDay && <TimePicker label="Начало" value={form.startTime} onChange={(startTime) => setForm(withStart(form, { startTime }))} />}
          </DateRow>

          <DateRow>
            <Field label="Конец">
              <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm(withEnd(form, { endDate: e.target.value }))} />
            </Field>
            {!form.allDay && <TimePicker label="Конец" value={form.endTime} onChange={(endTime) => setForm(withEnd(form, { endTime }))} />}
          </DateRow>

          <Participants>
            <legend>Кто видит и участвует</legend>
            <Mode role="group" aria-label="Участники">
              <Chip type="button" aria-pressed={form.allFamily} $active={form.allFamily} onClick={() => patch({ allFamily: true })}>
                Вся семья
              </Chip>
              <Chip type="button" aria-pressed={!form.allFamily} $active={!form.allFamily} onClick={() => patch({ allFamily: false })}>
                Выбрать
              </Chip>
            </Mode>
            {!form.allFamily && (
              <>
                <People>
                  <PersonChip type="button" $active disabled aria-label="Вы участвуете всегда">
                    <Avatar name={profile?.me.name ?? identity.name} seed={identity.memberId} src={profile?.me.avatar} size="1.7rem" />
                    Вы
                  </PersonChip>
                  {others.map((member) => (
                    <PersonChip key={member.id} type="button" $active={form.memberIds.includes(member.id)} aria-pressed={form.memberIds.includes(member.id)} onClick={() => toggle(member.id)}>
                      <Avatar name={memberLabel(member, identity.role)} seed={member.id} src={member.avatar} size="1.7rem" />
                      {memberLabel(member, identity.role)}
                    </PersonChip>
                  ))}
                </People>
                <Notice $tone="muted">
                  {form.memberIds.length === 0 ? 'Событие увидите только вы.' : 'Событие увидят только выбранные участники и вы.'}
                </Notice>
              </>
            )}
          </Participants>

          {error && <Notice $tone="error">{error}</Notice>}
          <Button $variant="primary" type="submit" disabled={busy}>
            {id ? 'Сохранить' : 'Создать событие'}
          </Button>
          {id && (
            <Button $variant="danger" type="button" disabled={busy} onClick={remove}>
              Удалить событие
            </Button>
          )}
        </Stack>
      )}
    </Page>
  )
}
