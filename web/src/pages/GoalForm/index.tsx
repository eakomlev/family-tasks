import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, createGoal, deleteGoal, getGoal, updateGoal, type Goal } from '@/api'
import { BackLink } from '@/components/BackLink'
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
import { HiddenInput, ImageButtons, ImageRow } from './styles'
import { describeGoalError, emptyGoalForm, fromGoal, toGoalInput, validateGoal, type GoalFormState } from './utils'

// размер картинки цели: квадрат по центру, чтобы уложиться в лимит сервера
const IMAGE_SIZE = 256

// /family/:memberId/goals/new — создание цели ребёнку; /goals/:goalId/edit — изменение (только родители, только не купленная)
export default function GoalForm() {
  const { memberId, goalId } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const [goal, setGoal] = useState<Goal>()
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>(goalId ? 'loading' : 'ready')
  const [form, setForm] = useState<GoalFormState>(emptyGoalForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const file = useRef<HTMLInputElement>(null)

  const token = identity?.token
  const isParent = !!identity && identity.role !== 'child'

  useEffect(() => {
    if (!token || !goalId) return
    let cancelled = false
    getGoal(token, goalId)
      .then((res) => {
        if (cancelled) return
        setGoal(res.goal)
        setForm(fromGoal(res.goal))
        setState('ready')
      })
      .catch((err) => !cancelled && setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed'))
    return () => { cancelled = true }
  }, [token, goalId])

  if (!identity || !token) return null
  if (!isParent || state === 'missing') return <Navigate to="/coins" replace />
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

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = validateGoal(form)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      if (goal) {
        await updateGoal(token!, goal.id, toGoalInput(form))
        navigate(`/goals/${goal.id}`, { replace: true })
      } else {
        await createGoal(token!, ownerId!, toGoalInput(form))
        navigate(`/family/${ownerId}/goals`, { replace: true })
      }
    } catch (err) {
      setError(describeGoalError(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!goal) return
    const ok = await confirm({ title: 'Удалить цель?', message: 'Это действие нельзя отменить.', confirmLabel: 'Удалить', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      await deleteGoal(token!, goal.id)
      navigate(`/family/${goal.memberId}/goals`, { replace: true })
    } catch (err) {
      setError(describeGoalError(err))
      setBusy(false)
    }
  }

  const childName = data?.members.find((m) => m.id === ownerId)?.name

  return (
    <Page>
      <BackLink to={goal ? `/goals/${goal.id}` : `/family/${memberId}/goals`}>← {goal ? 'Цель' : 'Цели'}</BackLink>
      <h1>{goal ? 'Изменить цель' : childName ? `Новая цель: ${childName}` : 'Новая цель'}</h1>

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
