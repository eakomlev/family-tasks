import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FAMILY_CHAT, listChatLinks, listChatMedia, searchChatMessages, type ChatLink, type ChatMediaItem, type ChatSearchResult } from '@/api'
import { useChats } from '@/chat/context'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS, memberLabel } from '@/lib/roles'
import { useCursorList } from '@/lib/useCursorList'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useSetChatMutedMutation } from '@/store/chat'
import { chatTitle } from '../Chat/utils'
import { PhotoViewer } from '../ChatRoom/components/PhotoViewer'
import { dayLabel, formatMessageTime, participantsLabel } from '../ChatRoom/utils'
import { ActionRow, Found, GroupIcon, Grid, LinkRow, Panel, Profile, Role, Rows, SearchRow, Sentinel, Slider, Switch, Tab, Tabs, Thumb } from './styles'

type TabKey = 'media' | 'links'

// Информация о чате, как в Телеграме: собеседник (или общий чат), уведомления, поиск по сообщениям и ниже вкладки «Медиа» (все фото)
// и «Ссылки» (все ссылки из сообщений). Открывается по нажатию на имя в шапке переписки.
export default function ChatInfo() {
  const { chat } = useParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const now = useNow()
  const [setMuted] = useSetChatMutedMutation()
  const token = identity?.token

  const [tab, setTab] = useState<TabKey>('media')
  const [searching, setSearching] = useState(false)
  const [text, setText] = useState('')
  // запрос уходит с небольшой задержкой после набора, чтобы не слать его на каждую букву
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<number>()
  const [muteError, setMuteError] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 350)
    return () => clearTimeout(timer)
  }, [text])

  const media = useCursorList<ChatMediaItem>(
    async (before) => {
      const page = await listChatMedia(token!, chat!, before)
      return { items: page.items, hasMore: page.hasMore, cursor: page.items.length > 0 ? page.items[page.items.length - 1].id : null }
    },
    [chat, token],
    !!token && !!chat && !searching && tab === 'media',
  )
  const links = useCursorList<ChatLink>(
    async (before) => {
      const page = await listChatLinks(token!, chat!, before)
      return { items: page.items, hasMore: page.hasMore, cursor: page.lastMessageId }
    },
    [chat, token],
    !!token && !!chat && !searching && tab === 'links',
  )
  const found = useCursorList<ChatSearchResult>(
    async (before) => {
      const page = await searchChatMessages(token!, chat!, query, before)
      return { items: page.messages, hasMore: page.hasMore, cursor: page.messages.length > 0 ? page.messages[page.messages.length - 1].id : null }
    },
    [chat, token, query],
    !!token && !!chat && searching && query.length > 0,
  )

  const mode: 'search' | TabKey = searching ? 'search' : tab
  const active = mode === 'search' ? found : mode === 'media' ? media : links

  // подгрузка по прокрутке: сторож в конце списка
  const loadMore = active.loadMore
  useEffect(() => {
    const el = sentinel.current
    if (!el || !active.hasMore || active.failed || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active.hasMore, active.failed, active.items, loadMore])

  if (!identity || !chat) return <Navigate to="/chat" replace />
  const members = data?.members ?? []
  const other = chat === FAMILY_CHAT ? undefined : members.find((m) => m.id === chat)
  const title = chatTitle(chat, members, identity.role)
  const muted = chats?.find((c) => c.id === chat)?.muted ?? false
  const nameOf = (id: string) => {
    const member = members.find((m) => m.id === id)
    return member ? memberLabel(member, identity.role) : 'Участник'
  }
  const when = (iso: string) => `${dayLabel(iso, now)}, ${formatMessageTime(iso)}`
  const showEmpty = active.items !== undefined && active.items.length === 0 && !active.failed && (mode !== 'search' || query.length > 0)
  const emptyText = mode === 'media' ? 'В этом чате пока нет фото.' : mode === 'links' ? 'В этом чате пока нет ссылок.' : 'Ничего не найдено.'

  async function toggleMute() {
    setMuteError(false)
    try {
      await setMuted({ chat: chat!, muted: !muted }).unwrap().catch(toApiError)
    } catch {
      setMuteError(true)
    }
  }

  function stopSearch() {
    setSearching(false)
    setText('')
    setQuery('')
  }

  return (
    <Page>
      <PageHeader to={`/chat/${chat}`}>Информация</PageHeader>

      <Profile>
        {other ? (
          <Avatar name={memberLabel(other, identity.role)} seed={other.id} src={other.avatar} size="6rem" />
        ) : (
          <GroupIcon aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 13c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4Zm7.5.2c2.6.3 4.5 1.7 4.5 3.8v2h-4v-2c0-1.4-.2-2.8-.5-3.8Z" />
            </svg>
          </GroupIcon>
        )}
        <h2>{title}</h2>
        {other && (
          <>
            <Role>{ROLE_LABELS[other.role]}</Role>
            {other.birthDate && <p>{formatBirthDate(other.birthDate)} · {formatAge(ageFromBirthDate(other.birthDate))}</p>}
            <Button as={Link} $variant="text" to={`/family/${other.id}`}>Открыть профиль</Button>
          </>
        )}
        {chat === FAMILY_CHAT && <p>{participantsLabel(members.length)}</p>}
      </Profile>

      <Panel>
        <ActionRow type="button" role="switch" aria-checked={!muted} aria-label="Уведомления" onClick={() => void toggleMute()}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />
          </svg>
          <span>Уведомления</span>
          <Switch $on={!muted} />
        </ActionRow>
        <ActionRow type="button" onClick={() => setSearching(true)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <span>Поиск сообщений</span>
        </ActionRow>
      </Panel>
      {muteError && <Notice $tone="error">Не удалось изменить уведомления. Попробуйте ещё раз.</Notice>}

      {searching ? (
        <SearchRow>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Поиск по сообщениям" aria-label="Поиск по сообщениям" maxLength={100} />
          <Button type="button" $variant="text" onClick={stopSearch}>Отмена</Button>
        </SearchRow>
      ) : (
        <Tabs role="tablist" aria-label="Что показать">
          <Slider $index={tab === 'media' ? 0 : 1} aria-hidden />
          <Tab type="button" role="tab" aria-selected={tab === 'media'} $active={tab === 'media'} onClick={() => setTab('media')}>Медиа</Tab>
          <Tab type="button" role="tab" aria-selected={tab === 'links'} $active={tab === 'links'} onClick={() => setTab('links')}>Ссылки</Tab>
        </Tabs>
      )}

      {active.failed && !active.items && (
        <Notice $tone="error">
          Не удалось загрузить. <Button $variant="text" type="button" onClick={active.reload}>Повторить</Button>
        </Notice>
      )}
      {!active.items && !active.failed && (mode !== 'search' || query.length > 0) && <p>Загрузка…</p>}
      {showEmpty && <Notice $tone="muted">{emptyText}</Notice>}

      {mode === 'media' && media.items && media.items.length > 0 && (
        <Grid>
          {media.items.map((item, i) => (
            <li key={item.id}>
              <Thumb type="button" aria-label={`Фото ${i + 1}`} onClick={() => setViewing(i)}>
                <img src={item.thumbUrl} width={item.width} height={item.height} alt="" loading="lazy" />
              </Thumb>
            </li>
          ))}
        </Grid>
      )}
      {mode === 'links' && links.items && links.items.length > 0 && (
        <Rows aria-label="Ссылки">
          {links.items.map((item, i) => (
            <li key={`${item.messageId}:${item.url}:${i}`}>
              <LinkRow href={item.url} target="_blank" rel="noopener noreferrer">
                {item.url}
                <small>{nameOf(item.senderId)} · {when(item.createdAt)}</small>
              </LinkRow>
            </li>
          ))}
        </Rows>
      )}
      {mode === 'search' && found.items && found.items.length > 0 && (
        <Rows aria-label="Найденные сообщения">
          {found.items.map((item) => (
            <Found key={item.id}>
              <small>{nameOf(item.senderId)} · {when(item.createdAt)}</small>
              {item.text}
            </Found>
          ))}
        </Rows>
      )}

      {active.failed && active.items && (
        <Notice $tone="error">
          Не удалось загрузить ещё. <Button $variant="text" type="button" onClick={loadMore}>Повторить</Button>
        </Notice>
      )}
      {active.hasMore && !active.failed && (
        <>
          <Sentinel ref={sentinel} />
          <Button $variant="text" type="button" disabled={active.loading} onClick={loadMore}>
            {active.loading ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </>
      )}

      {media.items && viewing !== undefined && <PhotoViewer photos={media.items} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(undefined)} />}
    </Page>
  )
}
