import { useState } from 'react'
import { View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { pickSquareImage } from '@/lib/image'
import { isParent } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useCreateGoalMutation, useDeleteGoalMutation, useGetGoalQuery, useUpdateGoalMutation } from '@/store/goals'
import { GoalImage } from './GoalCard'
import { describeGoalError, emptyGoalForm, fromGoal, toGoalInput, validateGoal, type GoalFormState } from './goalForm'

// размер картинки цели: квадрат по центру, чтобы уложиться в лимит сервера
const IMAGE_SIZE = 256

// Создание цели ребёнку (memberId) или изменение цели (goalId): только родители, купленную менять нельзя
export function GoalFormScreen({ memberId, goalId }: { memberId?: string; goalId?: string }) {
  const guard = useInFlight()
  const router = useRouter()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const { data } = useProfile()

  const [form, setForm] = useState<GoalFormState>(emptyGoalForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

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
  if (!isParentViewer || state === 'missing') return <Redirect href="/coins" />
  // купленную цель менять нельзя
  if (goal?.purchasedAt) return <Redirect href={{ pathname: '/goals/[goalId]', params: { goalId: goal.id } }} />

  const ownerId = goal?.memberId ?? memberId
  const patch = (changes: Partial<GoalFormState>) => {
    setForm((f) => ({ ...f, ...changes }))
    setError(undefined)
  }

  const pickImage = guard(async () => {
    try {
      const image = await pickSquareImage(IMAGE_SIZE, 0.75)
      if (image) patch({ image })
    } catch (err) {
      setError(describeGoalError(err))
    }
  })

  const submit = guard(async () => {
    const problem = validateGoal(form)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      if (goal) {
        await updateGoal({ id: goal.id, input: toGoalInput(form) }).unwrap().catch(toApiError)
        router.replace({ pathname: '/goals/[goalId]', params: { goalId: goal.id } })
      } else {
        await createGoal({ memberId: ownerId!, input: toGoalInput(form) }).unwrap().catch(toApiError)
        router.replace({ pathname: '/family/[memberId]/goals', params: { memberId: ownerId! } })
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
      router.replace({ pathname: '/family/[memberId]/goals', params: { memberId: goal.memberId } })
    } catch (err) {
      setError(describeGoalError(err))
      setBusy(false)
    }
  })

  const childName = data?.members.find((m) => m.id === ownerId)?.name

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback={goal ? { pathname: '/goals/[goalId]', params: { goalId: goal.id } } : { pathname: '/family/[memberId]/goals', params: { memberId: memberId! } }}>
        {goal ? '← Цель' : '← Цели'}
      </BackLink>
      <Title>{goal ? 'Изменить цель' : childName ? `Новая цель: ${childName}` : 'Новая цель'}</Title>

      {state === 'loading' && <Text $tone="muted">Загрузка…</Text>}
      {state === 'failed' && <Notice tone="error">Не удалось загрузить цель. Проверьте соединение.</Notice>}
      {state === 'ready' && (
        <Stack>
          <Field label="Название">
            <Input value={form.title} onChangeText={(title) => patch({ title })} maxLength={80} placeholder="Например, набор лего" />
          </Field>
          <Field label="Цена в монетах">
            <Input value={form.price} onChangeText={(price) => patch({ price: price.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Например, 300" />
          </Field>
          <Field label="Ссылка" hint="Необязательно: страница товара или услуги.">
            <Input
              value={form.url}
              onChangeText={(url) => patch({ url })}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
              placeholder="https://…"
            />
          </Field>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <GoalImage goal={{ image: form.image, title: form.title, purchasedAt: null }} />
            <View style={{ flex: 1 }}>
              <Button variant="text" disabled={busy} onPress={pickImage}>
                {form.image ? 'Изменить картинку' : 'Добавить картинку'}
              </Button>
              {form.image && (
                <Button variant="text" disabled={busy} onPress={() => patch({ image: null })}>
                  Убрать картинку
                </Button>
              )}
            </View>
          </View>

          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="primary" disabled={busy} onPress={submit}>
            {busy ? 'Сохраняем…' : goal ? 'Сохранить' : 'Создать'}
          </Button>
          {goal && (
            <Button variant="danger" disabled={busy} onPress={remove}>
              Удалить цель
            </Button>
          )}
        </Stack>
      )}
    </Screen>
  )
}
