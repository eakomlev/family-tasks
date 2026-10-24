import { PageHeader } from '@/components/PageHeader'
import { SlideInPage as Page } from '@/components/Page'
import { ThemeSetting } from './components/ThemeSetting'

// Тема оформления: как в системе, светлая или тёмная
export default function ProfileTheme() {
  return (
    <Page>
      <PageHeader to="/profile">Тема</PageHeader>
      <ThemeSetting />
    </Page>
  )
}
