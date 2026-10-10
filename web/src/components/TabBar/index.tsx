import { Bar, Icon, TabLink, Tabs } from './styles'
import { TABS } from './utils'

export function TabBar() {
  return (
    <Bar aria-label="Разделы">
      <Tabs>
        {TABS.map((tab) => (
          <li key={tab.path}>
            <TabLink to={tab.path}>
              {({ isActive }) => (
                <>
                  <Icon $active={isActive} aria-hidden>{tab.icon}</Icon>
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
