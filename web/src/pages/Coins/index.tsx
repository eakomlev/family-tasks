import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { listCoinHistory, type CoinEntry } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/CoinBalance'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { START_PATH } from '@/lib/routes'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { GoalsList } from './components/GoalsList'
import { HistoryRow } from './components/HistoryRow'
import { List, Sentinel, Total } from './styles'
import { entryMeta, mergeNewest } from './utils'

// Баланс и история монет ребёнка: свежее сверху, старые записи подгружаются по мере прокрутки.
export default function Coins() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  // /coins у ребёнка свои монеты; /coins/:memberId у родителя монеты этого ребёнка
  const { memberId } = useParams()

  // загруженная история: свежие сверху; hasMore — есть ли ещё более старые записи
  const [history, setHistory] = useState<{ items: CoinEntry[]; hasMore: boolean; balance: number }>()
  const items = history?.items
  const hasMore = history?.hasMore ?? false
  const balance = history?.balance
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  // защита от двойной подгрузки: сторож может сработать несколько раз, пока идёт запрос
  const busy = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const token = identity?.token
  const isChild = identity?.role === 'child'
  const isParent = !!identity && !isChild
  // чьи монеты смотрим: свои (ребёнок) или выбранного ребёнка (родитель)
  const ownerId = isChild ? undefined : memberId
  const canView = isChild || (isParent && !!memberId)

  // начисления делают родители или система: запись появляется сама
  useLive(['members'], () => setVersion((v) => v + 1))

  useEffect(() => {
    if (!token || !canView) return
    let cancelled = false
    listCoinHistory(token, undefined, ownerId)
      .then((page) => {
        if (cancelled) return
        setHistory((current) => ({
          ...mergeNewest(current?.items ?? [], page.items, page.hasMore, current?.hasMore ?? false),
          balance: page.balance,
        }))
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [token, canView, ownerId, version])

  const loadMore = useCallback(async () => {
    if (!token || !items?.length || busy.current) return
    busy.current = true
    setLoadingMore(true)
    try {
      const page = await listCoinHistory(token, items[items.length - 1].id, ownerId)
      setHistory((current) => {
        const known = current?.items ?? []
        return { items: [...known, ...page.items.filter((e) => !known.some((k) => k.id === e.id))], hasMore: page.hasMore, balance: page.balance }
      })
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      busy.current = false
      setLoadingMore(false)
    }
  }, [token, items, ownerId])

  // подгрузка при прокрутке: следим за сторожем в конце списка
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || failed || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), {
      rootMargin: '300px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, failed, loadMore, items])

  // монеты есть только у детей; родителю нужен выбранный ребёнок
  if (identity && !canView) return <Navigate to={START_PATH} replace />
  if (!identity) return null
  const members = data?.members ?? []
  const owner = members.find((m) => m.id === memberId)

  return (
    <Page>
      {isChild ? (
        <BackLink to={START_PATH}>← Мой день</BackLink>
      ) : (
        <BackLink to={`/family/${memberId}`}>← {owner?.name ?? 'Назад'}</BackLink>
      )}
      <h1>{isChild || !owner ? 'Монеты' : `Монеты: ${owner.name}`}</h1>

      <Total aria-live="polite">
        <CoinIcon />
        <strong>{balance ?? data?.me.coins ?? 0}</strong>
        <span>сейчас на счёте</span>
      </Total>

      {/* цели видит и оплачивает сам ребёнок */}
      {isChild && <GoalsList balance={balance ?? data?.me.coins ?? 0} />}

      <h2>История</h2>
      {failed && !items && <Notice $tone="error">Не удалось загрузить историю. Проверьте соединение.</Notice>}
      {!items && !failed && <p>Загрузка…</p>}
      {items && items.length === 0 && <Notice $tone="muted">Пока нет ни одного начисления.</Notice>}
      {items && items.length > 0 && (
        <List>
          {items.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} meta={entryMeta(entry, members, identity.role)} />
          ))}
        </List>
      )}

      {failed && items && (
        <Notice $tone="error">Не удалось загрузить ещё. <Button $variant="text" type="button" onClick={() => void loadMore()}>Повторить</Button></Notice>
      )}
      {hasMore && !failed && (
        <>
          <Sentinel ref={sentinel} />
          <Button $variant="text" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </>
      )}
    </Page>
  )
}
