import { useRef, type TouchEvent } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChatsProvider } from '@/chat'
import { Avatar } from '@/components/Avatar'
import { ConsentGate } from '@/components/ConsentGate'
import { NoFamilyGate } from '@/components/NoFamilyGate'
import { PushPrompt } from '@/components/PushPrompt'
import { TabBar } from '@/components/TabBar'
import { useIdentity } from '@/identity/context'
import { ProfileProvider } from '@/profile'
import { TaskBadgeProvider } from '@/tasks'
import { RealtimeProvider } from '@/realtime'
import { RealtimeBridge } from '@/store/RealtimeBridge'
import { useProfile } from '@/profile/context'
import { CoinBalance } from '@/components/CoinBalance'
import { tabsFor } from '@/components/TabBar/utils'
import { START_PATH } from '@/lib/routes'
import { AddLink, Content, ProfileLink, Root, TopRight } from './styles'

function Shell() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const touch = useRef<{ x: number; y: number; ok: boolean } | null>(null)
  if (!identity) return null
  const TABS = tabsFor(identity.role)
  // согласие на обработку персональных данных ещё не дано (участник из прежних версий) или текст обновился: сначала оно
  if (data?.me.consentRequired) return <ConsentGate />
  // взрослого убрали из семьи: аккаунт остался, ему нужно создать семью или вступить в другую
  if (data?.me.detached) return <NoFamilyGate />
  // переписка (/chat/:chat) занимает весь экран, без панели табов (информация о чате обычная страница)
  const chatRoom = pathname.startsWith('/chat/') && !pathname.endsWith('/info') && pathname !== '/chat/archive'
  // как в приложении: панель табов только на четырёх главных разделах, на вложенных страницах её нет (там шапка со стрелкой «назад»)
  const rootPage = TABS.some((tab) => tab.path === pathname)
  const noTabs = chatRoom || !rootPage
  // значок профиля только на «Моём дне», в остальные разделы профиль открывается из «Семьи»; баланс монет ребёнка тоже только там
  const hideAvatar = pathname !== START_PATH
  // монеты есть только у детей; баланс показываем только на «Моём дне»
  const showCoins = data?.me.coins !== undefined && !hideAvatar
  // у ребёнка вкладки «Задачи» нет: «＋» нового задания (только себе) на «Моём дне»
  const showAdd = identity.role === 'child' && !hideAvatar

  // Главные разделы листаются пальцем влево и вправо. Жест не трогаем там, где палец начался на поле ввода,
  // полосе прокрутки вбок или своём слайдере (помечено data-no-swipe или role=tablist/slider).
  const swipe = {
    start: (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const blocked = !!target.closest('input, textarea, select, [data-no-swipe], [role=tablist], [role=slider]')
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ok: rootPage && !blocked }
    },
    end: (e: TouchEvent) => {
      const from = touch.current
      touch.current = null
      if (!from?.ok) return
      const dx = e.changedTouches[0].clientX - from.x
      const dy = e.changedTouches[0].clientY - from.y
      if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) / 2) return
      const index = TABS.findIndex((tab) => tab.path === pathname)
      const next = TABS[index + (dx < 0 ? 1 : -1)]
      if (next) navigate(next.path)
    },
  }

  return (
    <Root onTouchStart={swipe.start} onTouchEnd={swipe.end} $noTabs={noTabs} $reserve={showCoins ? (hideAvatar ? '6.5rem' : showAdd ? '12.4rem' : '9.5rem') : hideAvatar ? '0rem' : '3.25rem'}>
      <PushPrompt />
      <TopRight $fixed={chatRoom}>
        {showCoins && <CoinBalance coins={data.me.coins!} />}
        {showAdd && (
          <AddLink to="/tasks/new" aria-label="Новая задача" title="Новая задача">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </AddLink>
        )}
        {/* на странице профиля и в переписке значок не нужен */}
        {!hideAvatar && (
          <ProfileLink to="/profile" aria-label={`Профиль: ${identity.name}`}>
            <Avatar name={data?.me.name ?? identity.name} seed={identity.memberId} src={data?.me.avatar} />
          </ProfileLink>
        )}
      </TopRight>
      <Content>
        <Outlet />
      </Content>
      {!noTabs && <TabBar tabs={TABS} />}
    </Root>
  )
}

// общий каркас разделов: значок профиля сверху, страница, панель табов снизу
export function AppShell() {
  const { identity } = useIdentity()
  if (!identity) return <Navigate to="/" replace />

  return (
    <RealtimeProvider token={identity.token}>
      <RealtimeBridge />
      <ProfileProvider>
        <ChatsProvider>
          <TaskBadgeProvider>
            <Shell />
          </TaskBadgeProvider>
        </ChatsProvider>
      </ProfileProvider>
    </RealtimeProvider>
  )
}
