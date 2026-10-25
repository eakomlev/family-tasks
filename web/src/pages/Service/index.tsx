import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useGetMediaStatsQuery, useGetQueueStatsQuery, useGetServiceStatsQuery } from '@/store/admin'
import { startOfDayIso } from '../MyDay/utils'
import { Card, Cards, Section } from './styles'
import { formatAge, formatBytes, mediaAlerts, queueAlerts } from './utils'

const format = (n: number) => n.toLocaleString('ru-RU')

// «Сервис»: сводка для администратора (адреса в ADMIN_EMAILS на сервере): аккаунты, семьи и сообщения, всего и за сегодня,
// и состояние очереди отправки писем и push. Для остальных страницы нет.
export default function Service() {
  const { data } = useProfile()
  const now = useNow()
  const isAdmin = !!data?.me.isAdmin
  // из кэша сразу, свежее приходит следом; пока страница открыта, обновляется раз в полминуты
  const { data: stats, isError } = useGetServiceStatsQuery(startOfDayIso(now), { skip: !isAdmin, pollingInterval: 30_000 })

  const { data: queue, isError: queueFailed } = useGetQueueStatsQuery(undefined, { skip: !isAdmin, pollingInterval: 30_000 })

  const { data: media } = useGetMediaStatsQuery(undefined, { skip: !isAdmin, pollingInterval: 30_000 })

  if (data && !isAdmin) return <Navigate to="/profile" replace />

  return (
    <Page>
      <PageHeader to="/profile">Сервис</PageHeader>
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
      <Section aria-label="Очередь отправки">
        <h2>Очередь отправки</h2>
        {queueFailed && !queue && <Notice $tone="error">Не удалось загрузить состояние очереди.</Notice>}
        {queue && (
          <>
            {queueAlerts(queue, now).map((alert) => (
              <Notice key={alert.text} $tone={alert.tone === 'error' ? 'error' : alert.tone === 'warning' ? 'warning' : 'muted'}>{alert.text}</Notice>
            ))}
            <Cards>
              <Card><span>Писем ждут</span><strong>{format(queue.waiting.email)}</strong></Card>
              <Card><span>Push ждут</span><strong>{format(queue.waiting.push)}</strong></Card>
              <Card><span>Ждут повтора</span><strong>{format(queue.retrying)}</strong></Card>
              <Card><span>Самое старое</span><strong>{queue.oldestSeconds === null ? '—' : formatAge(queue.oldestSeconds)}</strong></Card>
              <Card $small>
                <span>Сервис отправки</span>
                <strong>{queue.notifier.alive ? 'работает' : 'не отвечает'}</strong>
              </Card>
              <Card $small>
                <span>Писем за сутки (UTC)</span>
                <strong>{queue.mail.limit > 0 ? `${format(queue.mail.usedToday)} из ${format(queue.mail.limit)}` : format(queue.mail.usedToday)}</strong>
              </Card>
              <Card $small>
                <span>Отправлено сегодня</span>
                <strong>письма {format(queue.today.email.sent)} · push {format(queue.today.push.sent)}</strong>
              </Card>
              <Card $small>
                <span>Не удалось сегодня</span>
                <strong>письма {format(queue.today.email.failed)} · push {format(queue.today.push.failed)}</strong>
              </Card>
            </Cards>
          </>
        )}
      </Section>
      {queue?.scheduler && (
        <Section aria-label="Планировщик">
          <h2>Планировщик</h2>
          <Cards>
            <Card $small>
              <span>Состояние</span>
              <strong>{queue.scheduler.alive ? 'работает' : 'не отвечает'}</strong>
            </Card>
            <Card $small>
              <span>Последний проход</span>
              <strong>{queue.scheduler.lastTickSeconds === null ? '—' : `${formatAge(queue.scheduler.lastTickSeconds)} назад`}</strong>
            </Card>
            <Card $small>
              <span>Поставил в очередь</span>
              <strong>{queue.scheduler.lastSent === null ? '—' : format(queue.scheduler.lastSent)}</strong>
            </Card>
          </Cards>
        </Section>
      )}
      {queue?.realtime && (
        <Section aria-label="Живые обновления">
          <h2>Живые обновления</h2>
          <Cards>
            <Card $small>
              <span>Состояние</span>
              <strong>{queue.realtime.alive ? 'работает' : 'не отвечает'}</strong>
            </Card>
            <Card $small>
              <span>Соединений сейчас</span>
              <strong>{format(queue.realtime.connections)}</strong>
            </Card>
          </Cards>
        </Section>
      )}
      {media && (
        <Section aria-label="Фото">
          <h2>Фото в чатах</h2>
          {mediaAlerts(media).map((alert) => (
            <Notice key={alert.text} $tone={alert.tone === 'error' ? 'error' : alert.tone === 'warning' ? 'warning' : 'muted'}>{alert.text}</Notice>
          ))}
          {media.configured && (
            <Cards>
              <Card $small>
                <span>Сервис фото</span>
                <strong>{media.alive ? 'работает' : 'не отвечает'}</strong>
              </Card>
              <Card><span>Фото всего</span><strong>{format(media.photos)}</strong></Card>
              <Card><span>Занято места</span><strong>{formatBytes(media.bytes)}</strong></Card>
              <Card $small>
                <span>Не прикреплено к сообщениям</span>
                <strong>{format(media.unattached.photos)} · {formatBytes(media.unattached.bytes)}</strong>
              </Card>
              <Card $small>
                <span>Больше всего у семьи</span>
                <strong>{formatBytes(media.busiestFamilyBytes)} из {formatBytes(media.quotaBytes)}</strong>
              </Card>
            </Cards>
          )}
        </Section>
      )}
    </Page>
  )
}
