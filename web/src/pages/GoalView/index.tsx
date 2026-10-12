import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, deleteGoal, getGoal, purchaseGoal, type Goal } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/CoinBalance'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { GoalImage } from '@/components/GoalCard'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime } from '@/lib/date'
import { useLive } from '@/realtime/context'
import { Details, PriceLine } from './styles'
import { useInFlight } from '@/lib/useInFlight'

// Карточка цели (только просмотр): ребёнок видит «Оплатить» или сколько не хватает, родитель «Изменить»
export default function GoalView() {
  const guard = useInFlight()
  const { goalId } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { identity } = useIdentity()
  const [data, setData] = useState<{ goal: Goal; balance: number }>()
  const [state, setState] = useState<'loading' | 'missing' | 'failed' | 'ready'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [version, setVersion] = useState(0)
  // цель купили, изменили или удалили; баланс поменялся
  useLive(['goals', 'members'], () => setVersion((v) => v + 1))

  const token = identity?.token

  useEffect(() => {
    if (!token || !goalId) return
    let cancelled = false
    getGoal(token, goalId)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setState('ready')
      })
      .catch((err) => !cancelled && setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'failed'))
    return () => { cancelled = true }
  }, [token, goalId, version])

  if (!identity || !token) return null
  const isChild = identity.role === 'child'
  const back = isChild ? '/coins' : data ? `/family/${data.goal.memberId}/goals` : '/family'
  if (state === 'missing') return <Navigate to={back} replace />

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
      const res = await purchaseGoal(token!, goal.id)
      setData(res)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_enough_coins') {
        setError('Не хватает монет. Баланс обновился.')
        setVersion((v) => v + 1)
      } else if (err instanceof ApiError && err.code === 'already_purchased') {
        setVersion((v) => v + 1)
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
      await deleteGoal(token!, goal.id)
      navigate(back, { replace: true })
    } catch {
      setError('Не удалось удалить цель. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Page>
      <BackLink to={back}>← {isChild ? 'Монеты' : 'Цели'}</BackLink>
      {state === 'loading' && <p>Загрузка…</p>}
      {state === 'failed' && !goal && <Notice $tone="error">Не удалось загрузить цель. Проверьте соединение.</Notice>}
      {goal && (
        <>
          <GoalImage goal={goal} large />
          <Details>
            <h1>{goal.title}</h1>
            <PriceLine>
              <CoinIcon />
              {goal.price}
            </PriceLine>
            {goal.url && (
              <a href={goal.url} target="_blank" rel="noopener noreferrer">{goal.url}</a>
            )}
            {bought && goal.purchasedAt && <Notice $tone="muted">Куплено {formatDateTime(goal.purchasedAt)}.</Notice>}
          </Details>

          {!bought && isChild && (
            <>
              {missing > 0 ? (
                <Notice $tone="muted">Не хватает {coinsWord(missing)}: на счёте {balance} из {goal.price}.</Notice>
              ) : (
                <Notice $tone="muted">Монет хватает: на счёте {balance}.</Notice>
              )}
              {error && <Notice $tone="error">{error}</Notice>}
              <Button $variant="primary" type="button" disabled={busy || missing > 0} onClick={pay}>
                {busy ? 'Оплачиваем…' : `Оплатить: ${goal.price}`}
              </Button>
            </>
          )}

          {!isChild && (
            <>
              {error && <Notice $tone="error">{error}</Notice>}
              {!bought && <Button type="button" disabled={busy} onClick={() => navigate(`/goals/${goal.id}/edit`)}>Изменить</Button>}
              <Button $variant="danger" type="button" disabled={busy} onClick={remove}>Удалить цель</Button>
            </>
          )}
        </>
      )}
    </Page>
  )
}
