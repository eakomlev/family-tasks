import { useCallback, useEffect, useRef, useState } from 'react'
import { retryRead } from '@/lib/retry'

export interface CursorPage<T> {
  items: T[]
  hasMore: boolean
  // с чего продолжить (передаётся в следующий запрос); null — страниц больше нет
  cursor: string | null
}

// Список с подгрузкой страниц по курсору (вкладки «Медиа», «Ссылки» и результаты поиска). Первая страница грузится при смене
// `deps`, следующие по `loadMore`. Повторные вызовы во время запроса игнорируются. Если ничего грузить не нужно, `enabled` ложно.
export function useCursorList<T>(load: (cursor: string | undefined, signal: AbortSignal) => Promise<CursorPage<T>>, deps: unknown[], enabled = true) {
  const [items, setItems] = useState<T[]>()
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const cursor = useRef<string | null>(null)
  const busy = useRef(false)
  // поколение запроса: ответ на прежние условия (другой поисковый запрос) отбрасывается
  const generation = useRef(0)
  const loader = useRef(load)
  const controller = useRef<AbortController>(undefined)
  useEffect(() => {
    loader.current = load
  })
  // страница закрыта: повторы чтения без связи прекращаются
  useEffect(() => () => controller.current?.abort(), [])

  const run = useCallback(async (more: boolean) => {
    if (busy.current && more) return
    const mine = ++generation.current
    busy.current = true
    setLoading(true)
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    try {
      const page = await retryRead(() => loader.current(more ? (cursor.current ?? undefined) : undefined, abort.signal), abort.signal)
      if (mine !== generation.current) return
      cursor.current = page.cursor
      setItems((current) => (more ? [...(current ?? []), ...page.items] : page.items))
      setHasMore(page.hasMore && page.cursor !== null)
      setFailed(false)
    } catch {
      if (mine === generation.current) setFailed(true)
    } finally {
      if (mine === generation.current) {
        busy.current = false
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- сброс списка при смене условий и первая загрузка
    setItems(undefined)
    setHasMore(false)
    setFailed(false)
    cursor.current = null
    if (!enabled) {
      generation.current++
      busy.current = false
      setLoading(false)
      return
    }
    void run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { items, hasMore, failed, loading, loadMore: () => hasMore && !failed && void run(true), reload: () => void run(false) }
}
