import { PageHeader } from '@/components/PageHeader'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { FontScaleSetting } from './components/FontScaleSetting'
import { ThemeSetting } from './components/ThemeSetting'

// Оформление: тема (как в системе, светлая или тёмная) и размер шрифта на одной странице
export default function ProfileTheme() {
  return (
    <Page>
      <PageHeader to="/profile">Оформление</PageHeader>
      <Stack as="section">
        <h2>Тема</h2>
        <ThemeSetting />
      </Stack>
      <Stack as="section">
        <h2>Размер шрифта</h2>
        <FontScaleSetting />
      </Stack>
    </Page>
  )
}
