import { BackLink } from '@/components/BackLink'
import { SlideInPage as Page } from '@/components/Page'
import { ThemeSetting } from './components/ThemeSetting'

// Тема оформления: как в системе, светлая или тёмная
export default function ProfileTheme() {
  return (
    <Page>
      <BackLink to="/profile">← Профиль</BackLink>
      <ThemeSetting />
    </Page>
  )
}
