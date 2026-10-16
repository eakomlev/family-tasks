import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { listChatMedia, type ChatMediaItem } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { PhotoViewer } from '../ChatRoom/components/PhotoViewer'
import { chatTitle } from '../Chat/utils'
import { Grid, Sentinel, Thumb } from './styles'

// Все фото чата («Медиа файлы» в меню чата): свежие первыми, старые подгружаются по мере прокрутки; нажатие открывает просмотр.
export default function ChatMedia() {
  const { chat } = useParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const token = identity?.token

  const [items, setItems] = useState<ChatMediaItem[]>()
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewing, setViewing] = useState<number>()
  // защита от двойной подгрузки: сторож может сработать несколько раз, пока идёт запрос
  const busy = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)

  // before не задан: первая страница; иначе более старые после фото с этим id
  const load = useCallback(
    async (before?: string) => {
      if (!token || !chat || busy.current) return
      busy.current = true
      setLoading(true)
      try {
        const page = await listChatMedia(token, chat, before)
        setItems((current) => {
          const known = current ?? []
          return before ? [...known, ...page.items.filter((p) => !known.some((k) => k.id === p.id))] : page.items
        })
        setHasMore(page.hasMore)
        setFailed(false)
      } catch {
        setFailed(true)
      } finally {
        busy.current = false
        setLoading(false)
      }
    },
    [token, chat],
  )

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- первая загрузка при открытии экрана
    void load()
  }, [load])

  const loadMore = useCallback(() => {
    if (items?.length) void load(items[items.length - 1].id)
  }, [items, load])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || failed || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, failed, loadMore, items])

  if (!identity || !chat) return <Navigate to="/chat" replace />
  const title = chatTitle(chat, data?.members ?? [], identity.role)

  return (
    <Page>
      <BackLink to={`/chat/${chat}`}>← {title}</BackLink>
      <h1>Медиа файлы</h1>
      {failed && !items && (
        <Notice $tone="error">
          Не удалось загрузить фото. <Button $variant="text" type="button" onClick={() => void load()}>Повторить</Button>
        </Notice>
      )}
      {!items && !failed && <p>Загрузка…</p>}
      {items && items.length === 0 && <Notice $tone="muted">В этом чате пока нет фото.</Notice>}
      {items && items.length > 0 && (
        <Grid>
          {items.map((item, i) => (
            <li key={item.id}>
              <Thumb type="button" aria-label={`Фото ${i + 1}`} onClick={() => setViewing(i)}>
                <img src={item.thumbUrl} width={item.width} height={item.height} alt="" loading="lazy" />
              </Thumb>
            </li>
          ))}
        </Grid>
      )}
      {failed && items && (
        <Notice $tone="error">
          Не удалось загрузить ещё. <Button $variant="text" type="button" onClick={loadMore}>Повторить</Button>
        </Notice>
      )}
      {hasMore && !failed && (
        <>
          <Sentinel ref={sentinel} />
          <Button $variant="text" type="button" disabled={loading} onClick={loadMore}>
            {loading ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </>
      )}
      {items && viewing !== undefined && <PhotoViewer photos={items} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(undefined)} />}
    </Page>
  )
}
