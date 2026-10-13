import { Navigate } from 'react-router-dom'
import { BackLink } from '@/components/BackLink'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useGetServiceStatsQuery } from '@/store/admin'
import { startOfDayIso } from '../MyDay/utils'
import { Card, Cards, Section } from './styles'

const format = (n: number) => n.toLocaleString('ru-RU')

// «Сервис»: сводка для администратора (адреса в ADMIN_EMAILS на сервере): аккаунты, семьи и сообщения, всего и за сегодня.
// Для остальных страницы нет.
export default function Service() {
  const { data } = useProfile()
  const now = useNow()
  const isAdmin = !!data?.me.isAdmin
  // из кэша сразу, свежее приходит следом; пока страница открыта, обновляется раз в полминуты
  const { data: stats, isError } = useGetServiceStatsQuery(startOfDayIso(now), { skip: !isAdmin, pollingInterval: 30_000 })

  if (data && !isAdmin) return <Navigate to="/profile" replace />

  return (
    <Page>
      <BackLink to="/profile">← Профиль</BackLink>
      <h1>Сервис</h1>
      {isError && !stats && <Notice $tone="error">Не удалось загрузить статистику. Проверьте соединение.</Notice>}
      {!stats && !isError && <p>Загрузка…</p>}
      {stats && (
        <>
          <Section aria-label="Аккаунты">
            <h2>Аккаунты</h2>
            <Cards>
              <Card><span>Всего</span><strong>{format(stats.accounts.total)}</strong></Card>
              <Card><span>Новых сегодня</span><strong>{format(stats.accounts.today)}</strong></Card>
              <Card><span>Семей всего</span><strong>{format(stats.families.total)}</strong></Card>
              <Card><span>Новых семей сегодня</span><strong>{format(stats.families.today)}</strong></Card>
            </Cards>
          </Section>
          <Section aria-label="Сообщения">
            <h2>Сообщения</h2>
            <Cards>
              <Card><span>Отправлено всего</span><strong>{format(stats.messages.total)}</strong></Card>
              <Card><span>Сегодня</span><strong>{format(stats.messages.today)}</strong></Card>
            </Cards>
          </Section>
        </>
      )}
    </Page>
  )
}
