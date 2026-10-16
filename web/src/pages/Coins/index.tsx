import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { listCoinHistory, type CoinEntry } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinIcon } from '@/components/CoinBalance'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { retryRead } from '@/lib/retry'
import { START_PATH } from '@/lib/routes'
import { useAbortOnUnmount } from '@/lib/useAbortOnUnmount'
import { useProfile } from '@/profile/context'
import { useGetCoinHistoryQuery } from '@/store/coins'
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

  const token = identity?.token
  const isChild = identity?.role === 'child'
  const isParent = !!identity && !isChild
  // чьи монеты смотрим: свои (ребёнок) или выбранного ребёнка (родитель)
  const ownerId = isChild ? undefined : memberId
  const canView = isChild || (isParent && !!memberId)

  // Свежая первая страница из кэша: сохранённая на устройстве видна сразу; начисления делают родители или система,
  // сигнал `members` сбрасывает кэш, и новая запись встаёт сверху сама. Старые, уже подгруженные страницы остаются (mergeNewest).
  const first = useGetCoinHistoryQuery(ownerId ?? '', { skip: !canView })
  const firstPage = first.data

  // загруженная история: свежие сверху; hasMore — есть ли ещё более старые записи (с первого кадра из кэша, если он есть)
  const [history, setHistory] = useState<{ items: CoinEntry[]; hasMore: boolean; balance: number } | undefined>(() => firstPage)
  const items = history?.items
  const hasMore = history?.hasMore ?? false
  const balance = history?.balance
  const [loadingMore, setLoadingMore] = useState(false)
  // ошибка подгрузки старых записей; ошибка первой загрузки приходит из запроса
  const [moreFailed, setFailed] = useState(false)
  // защита от двойной подгрузки: сторож может сработать несколько раз, пока идёт запрос
  const busy = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const abort = useAbortOnUnmount()

  useEffect(() => {
    if (!firstPage) return
    // oxlint-disable-next-line react/set-state-in-effect -- сливаем пришедшую страницу с уже подгруженными старыми записями
    setHistory((current) => ({
      ...mergeNewest(current?.items ?? [], firstPage.items, firstPage.hasMore, current?.hasMore ?? false),
      balance: firstPage.balance,
    }))
    setFailed(false)
  }, [firstPage])
  const failed = moreFailed || (first.isError && !history)

  const loadMore = useCallback(async () => {
    if (!token || !items?.length || busy.current) return
    busy.current = true
    setLoadingMore(true)
    try {
      const page = await retryRead(() => listCoinHistory(token, items[items.length - 1].id, ownerId), abort.current?.signal)
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
  }, [token, items, ownerId, abort])

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
