import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { isParent } from '@/lib/roles'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Field } from '@/components/Field'
import { GoalImage } from '@/components/GoalCard'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { resizeToAvatar } from '@/lib/image'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCreateGoalMutation, useDeleteGoalMutation, useGetGoalQuery, useUpdateGoalMutation } from '@/store/goals'
import { HiddenInput, ImageButtons, ImageRow } from './styles'
import { describeGoalError, emptyGoalForm, fromGoal, toGoalInput, validateGoal, type GoalFormState } from './utils'
import { useInFlight } from '@/lib/useInFlight'

// размер картинки цели: квадрат по центру, чтобы уложиться в лимит сервера
const IMAGE_SIZE = 256

// /family/:memberId/goals/new — создание цели ребёнку; /goals/:goalId/edit — изменение (только родители, только не купленная)
export default function GoalForm() {
  const guard = useInFlight()
  const { memberId, goalId } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const [form, setForm] = useState<GoalFormState>(emptyGoalForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const file = useRef<HTMLInputElement>(null)

  const token = identity?.token
  const isParentViewer = isParent(identity?.role)

  // цель для изменения: из кэша сразу, свежее следом
  const query = useGetGoalQuery(goalId ?? '', { skip: !token || !goalId })
  const goal = query.data?.goal
  const queryError = query.error
  const state: 'loading' | 'ready' | 'missing' | 'failed' = !goalId
    ? 'ready'
    : goal
      ? 'ready'
      : queryError && 'status' in queryError && queryError.status === 404
        ? 'missing'
        : queryError
          ? 'failed'
          : 'loading'
  const [createGoal] = useCreateGoalMutation()
  const [updateGoal] = useUpdateGoalMutation()
  const [deleteGoal] = useDeleteGoalMutation()

  // форма заполняется данными цели один раз, когда она появилась (правки пользователя поверх не затираем)
  const [filledFor, setFilledFor] = useState<string>()
  if (goal && filledFor !== goal.id) {
    setFilledFor(goal.id)
    setForm(fromGoal(goal))
  }

  if (!identity || !token) return null
  if (!isParentViewer || state === 'missing') return <Navigate to="/coins" replace />
  // купленную цель менять нельзя
  if (goal?.purchasedAt) return <Navigate to={`/goals/${goal.id}`} replace />

  const ownerId = goal?.memberId ?? memberId
  const patch = (changes: Partial<GoalFormState>) => {
    setForm((f) => ({ ...f, ...changes }))
    setError(undefined)
  }

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    try {
      patch({ image: await resizeToAvatar(picked, IMAGE_SIZE, 0.75) })
    } catch (err) {
      setError(describeGoalError(err))
    }
  }

  const submit = guard(async (e: FormEvent) => {
    e.preventDefault()
    const problem = validateGoal(form)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      if (goal) {
        await updateGoal({ id: goal.id, input: toGoalInput(form) }).unwrap().catch(toApiError)
        navigate(`/goals/${goal.id}`, { replace: true })
      } else {
        await createGoal({ memberId: ownerId!, input: toGoalInput(form) }).unwrap().catch(toApiError)
        navigate(`/family/${ownerId}/goals`, { replace: true })
      }
    } catch (err) {
      setError(describeGoalError(err))
      setBusy(false)
    }
  })

  const remove = guard(async () => {
    if (!goal) return
    const ok = await confirm({ title: 'Удалить цель?', message: 'Это действие нельзя отменить.', confirmLabel: 'Удалить', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await deleteGoal(goal.id).unwrap().catch(toApiError)
      navigate(`/family/${goal.memberId}/goals`, { replace: true })
    } catch (err) {
      setError(describeGoalError(err))
      setBusy(false)
    }
  })

  const childName = data?.members.find((m) => m.id === ownerId)?.name

  return (
    <Page>
      <PageHeader to={goal ? `/goals/${goal.id}` : `/family/${memberId}/goals`}>{goal ? 'Изменить цель' : childName ? `Новая цель: ${childName}` : 'Новая цель'}</PageHeader>

      {state === 'loading' && <p>Загрузка…</p>}
      {state === 'failed' && <Notice $tone="error">Не удалось загрузить цель. Проверьте соединение.</Notice>}
      {state === 'ready' && (
        <Stack as="form" noValidate onSubmit={submit}>
          <Field label="Название">
            <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={80} placeholder="Например, набор лего" autoFocus={!goal} />
          </Field>
          <Field label="Цена в монетах">
            <Input value={form.price} onChange={(e) => patch({ price: e.target.value })} type="number" inputMode="numeric" min={1} placeholder="Например, 300" />
          </Field>
          <Field label="Ссылка" hint="Необязательно: страница товара или услуги.">
            <Input value={form.url} onChange={(e) => patch({ url: e.target.value })} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" maxLength={500} placeholder="https://…" />
          </Field>

          <div>
            <ImageRow>
              <GoalImage goal={{ image: form.image, title: form.title, purchasedAt: null }} />
              <ImageButtons>
                <Button $variant="text" type="button" disabled={busy} onClick={() => file.current?.click()}>
                  {form.image ? 'Изменить картинку' : 'Добавить картинку'}
                </Button>
                {form.image && <Button $variant="text" type="button" disabled={busy} onClick={() => patch({ image: null })}>Убрать картинку</Button>}
              </ImageButtons>
            </ImageRow>
            <HiddenInput ref={file} type="file" accept="image/*" onChange={pickImage} />
          </div>

          {error && <Notice $tone="error">{error}</Notice>}
          <Button $variant="primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : goal ? 'Сохранить' : 'Создать'}</Button>
          {goal && <Button $variant="danger" type="button" disabled={busy} onClick={remove}>Удалить цель</Button>}
        </Stack>
      )}
    </Page>
  )
}
