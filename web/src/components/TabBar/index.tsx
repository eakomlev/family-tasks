import { useLocation } from 'react-router-dom'
import { useChats } from '@/chat/context'
import { useTaskBadge } from '@/tasks/context'
import { Badge, Bar, Highlight, Icon, IconWrap, Label, TabLink, Tabs } from './styles'
import { TabIcon } from './TabIcon'
import { TABS } from './utils'

export function TabBar() {
  const { unread } = useChats()
  const tasks = useTaskBadge()
  const { pathname } = useLocation()
  const index = Math.max(0, TABS.findIndex((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`)))
  return (
    <Bar aria-label="Разделы">
      <Tabs>
        {/* одна подсветка, которая переезжает к выбранному табу */}
        <Highlight aria-hidden="true" $index={index} $count={TABS.length} />
        {TABS.map((tab) => (
          <li key={tab.path}>
            <TabLink to={tab.path}>
              {({ isActive }) => (
                <>
                  <IconWrap>
                    <Icon $active={isActive} aria-hidden><TabIcon name={tab.icon} /></Icon>
                    {tab.path === '/tasks' && tasks > 0 && (
                      <Badge aria-label={`Заданий, ждущих действия: ${tasks}`}>{tasks > 99 ? '99+' : tasks}</Badge>
                    )}
                    {tab.path === '/chat' && unread > 0 && (
                      <Badge aria-label={`Непрочитанных сообщений: ${unread}`}>{unread > 99 ? '99+' : unread}</Badge>
                    )}
                  </IconWrap>
                  <Label $active={isActive}>{tab.label}</Label>
                </>
              )}
            </TabLink>
          </li>
        ))}
      </Tabs>
    </Bar>
  )
}
