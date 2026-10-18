import { useState } from 'react'
import { Linking, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ApiError } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/Coins'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Text, PageTitle } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime } from '@/lib/date'
import { isParent } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { toApiError } from '@/store/api'
import { useDeleteGoalMutation, useGetGoalQuery, usePurchaseGoalMutation } from '@/store/goals'
import { GoalImage } from './GoalCard'

// Карточка цели: ребёнок видит «Оплатить» или сколько не хватает, родитель «Изменить» и «Удалить»
export function GoalViewScreen({ goalId }: { goalId: string }) {
  const guard = useInFlight()
  const router = useRouter()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const token = identity?.token
  // цель из кэша сразу; покупку, правку или удаление подхватывают сигналы сокета
  const query = useGetGoalQuery(goalId, { skip: !token })
  const data = query.data
  const queryError = query.error
  const state: 'loading' | 'missing' | 'failed' | 'ready' = data
    ? 'ready'
    : queryError && 'status' in queryError && queryError.status === 404
      ? 'missing'
      : queryError
        ? 'failed'
        : 'loading'
  const [purchaseGoal] = usePurchaseGoalMutation()
  const [deleteGoal] = useDeleteGoalMutation()

  if (!identity || !token) return null
  const isChild = identity.role === 'child'
  const backHref = isChild ? '/coins' : data ? ({ pathname: '/family/[memberId]/goals', params: { memberId: data.goal.memberId } } as const) : '/family'
  if (state === 'missing') return <Redirect href={backHref} />

  const goal = data?.goal
  const balance = data?.balance ?? 0
  const missing = goal ? Math.max(0, goal.price - balance) : 0
  const bought = goal?.purchasedAt != null

  const pay = guard(async () => {
    if (!goal) return
    const ok = await confirm({
      title: 'Оплатить цель?',
      message: `«${goal.title}»: с вашего счёта спишется ${coinsWord(goal.price)}.`,
      confirmLabel: 'Оплатить',
    })
    if (!ok) return
    setBusy(true)
    setError(undefined)
    try {
      await purchaseGoal(goal.id).unwrap().catch(toApiError)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_enough_coins') {
        setError('Не хватает монет. Баланс обновился.')
        void query.refetch()
      } else if (err instanceof ApiError && err.code === 'already_purchased') {
        void query.refetch()
      } else {
        setError('Не удалось оплатить цель. Попробуйте ещё раз.')
      }
    } finally {
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
      router.replace(backHref)
    } catch {
      setError('Не удалось удалить цель. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback={backHref}>{`← ${isChild ? 'Монеты' : 'Цели'}`}</BackLink>
      {state === 'loading' && <Text $tone="muted">Загрузка…</Text>}
      {state === 'failed' && !goal && <Notice tone="error">Не удалось загрузить цель. Проверьте соединение.</Notice>}
      {goal && (
        <>
          <GoalImage goal={goal} large />
          <View style={{ gap: 8 }}>
            <PageTitle>{goal.title}</PageTitle>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CoinIcon size={26} />
              <Text $weight="black" $size={22}>
                {String(goal.price)}
              </Text>
            </View>
            {goal.url ? (
              <Text $tone="accent" onPress={() => void Linking.openURL(goal.url!)} style={{ textDecorationLine: 'underline' }}>
                {goal.url}
              </Text>
            ) : null}
            {bought && goal.purchasedAt && <Notice>{`Куплено ${formatDateTime(goal.purchasedAt)}.`}</Notice>}
          </View>

          {!bought && isChild && (
            <>
              <Notice>{missing > 0 ? `Не хватает ${coinsWord(missing)}: на счёте ${balance} из ${goal.price}.` : `Монет хватает: на счёте ${balance}.`}</Notice>
              {error && <Notice tone="error">{error}</Notice>}
              <Button variant="lime" disabled={busy || missing > 0} onPress={pay}>
                {busy ? 'Оплачиваем…' : `Оплатить: ${goal.price}`}
              </Button>
            </>
          )}

          {isParent(identity.role) && (
            <>
              {error && <Notice tone="error">{error}</Notice>}
              {!bought && (
                <Button disabled={busy} onPress={() => router.push({ pathname: '/goals/[goalId]/edit', params: { goalId: goal.id } })}>
                  Изменить
                </Button>
              )}
              <Button variant="danger" disabled={busy} onPress={remove}>
                Удалить цель
              </Button>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
