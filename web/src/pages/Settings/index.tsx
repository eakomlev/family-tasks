import { MenuLink } from '@/components/MenuLink'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ThemeSetting } from './components/ThemeSetting'
import { Bottom, Menu } from './styles'

export default function Settings() {
  const { identity } = useIdentity()

  return (
    <Page>
      <h1>Настройки</h1>
      {identity?.role === 'child' && (
        <Menu aria-label="Разделы настроек">
          <MenuLink to="/settings/schedule">Расписание уроков</MenuLink>
        </Menu>
      )}
      <Bottom>
        <ThemeSetting />
      </Bottom>
    </Page>
  )
}
