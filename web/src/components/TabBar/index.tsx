import { useChats } from '@/chat/context'
import { Badge, Bar, Icon, IconWrap, TabLink, Tabs } from './styles'
import { TabIcon } from './TabIcon'
import { TABS } from './utils'

export function TabBar() {
  const { unread } = useChats()
  return (
    <Bar aria-label="Разделы">
      <Tabs>
        {TABS.map((tab) => (
          <li key={tab.path}>
            <TabLink to={tab.path}>
              {({ isActive }) => (
                <>
                  <IconWrap>
                    <Icon $active={isActive} aria-hidden><TabIcon name={tab.icon} /></Icon>
                    {tab.path === '/chat' && unread > 0 && (
                      <Badge aria-label={`Непрочитанных сообщений: ${unread}`}>{unread > 99 ? '99+' : unread}</Badge>
                    )}
                  </IconWrap>
                  {tab.label}
                </>
              )}
            </TabLink>
          </li>
        ))}
      </Tabs>
    </Bar>
  )
}
