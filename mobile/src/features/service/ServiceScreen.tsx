import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { useGetMediaStatsQuery, useGetQueueStatsQuery, useGetServiceStatsQuery, useGetSmsStatsQuery } from '@/store/admin'
import { startOfDayIso } from '../myDay/utils'
import { formatAge, formatBytes, formatDay, formatRub, mediaAlerts, queueAlerts, smsAlerts, smsLeft } from './utils'

const format = (n: number) => n.toLocaleString('ru-RU')

// Плитка со значением: две в ряд
function Tile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: 2, padding: 12 }}>
      <Text $size={13} $tone="muted">
        {label}
      </Text>
      <Text $weight="black" $size={small ? 16 : 24}>
        {value}
      </Text>
    </Card>
  )
}

function Tiles({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>
}

// «Сервис»: сводка для администратора (адреса в ADMIN_EMAILS на сервере): аккаунты, семьи и сообщения, очередь отправки,
// планировщик и фото. Для остальных экрана нет.
export function ServiceScreen() {
  const { data } = useProfile()
  const now = useNow()
  const isAdmin = !!data?.me.isAdmin
  // из кэша сразу, свежее приходит следом; пока экран открыт, обновляется раз в полминуты
  const { data: stats, isError } = useGetServiceStatsQuery(startOfDayIso(now), { skip: !isAdmin, pollingInterval: 30_000 })
  const { data: queue, isError: queueFailed } = useGetQueueStatsQuery(undefined, { skip: !isAdmin, pollingInterval: 30_000 })
  const { data: media } = useGetMediaStatsQuery(undefined, { skip: !isAdmin, pollingInterval: 30_000 })
  const { data: sms } = useGetSmsStatsQuery(undefined, { skip: !isAdmin, pollingInterval: 30_000 })

  if (data && !isAdmin) return <Redirect href="/profile" />

  return (
    <Screen header={<PageHeader fallback="/profile">Сервис</PageHeader>}>
      {isError && !stats && <Notice tone="error">Не удалось загрузить статистику. Проверьте соединение.</Notice>}
      {!stats && !isError && <Text $tone="muted">Загрузка…</Text>}
      {stats && (
        <>
          <Stack $gap={8}>
            <Heading>Аккаунты</Heading>
            <Tiles>
              <Tile label="Всего" value={format(stats.accounts.total)} />
              <Tile label="Новых сегодня" value={format(stats.accounts.today)} />
              <Tile label="Семей всего" value={format(stats.families.total)} />
              <Tile label="Новых семей сегодня" value={format(stats.families.today)} />
            </Tiles>
          </Stack>
          <Stack $gap={8}>
            <Heading>Сообщения</Heading>
            <Tiles>
              <Tile label="Отправлено всего" value={format(stats.messages.total)} />
              <Tile label="Сегодня" value={format(stats.messages.today)} />
            </Tiles>
          </Stack>
        </>
      )}

      <Stack $gap={8}>
        <Heading>Очередь отправки</Heading>
        {queueFailed && !queue && <Notice tone="error">Не удалось загрузить состояние очереди.</Notice>}
        {queue && (
          <>
            {queueAlerts(queue, now).map((alert) => (
              <Notice key={alert.text} tone={alert.tone}>
                {alert.text}
              </Notice>
            ))}
            <Tiles>
              <Tile label="Писем ждут" value={format(queue.waiting.email)} />
              <Tile label="Push ждут" value={format(queue.waiting.push)} />
              <Tile label="Ждут повтора" value={format(queue.retrying)} />
              <Tile label="Самое старое" value={queue.oldestSeconds === null ? '—' : formatAge(queue.oldestSeconds)} />
              <Tile small label="Сервис отправки" value={queue.notifier.alive ? 'работает' : 'не отвечает'} />
              <Tile
                small
                label="Писем за сутки (UTC)"
                value={queue.mail.limit > 0 ? `${format(queue.mail.usedToday)} из ${format(queue.mail.limit)}` : format(queue.mail.usedToday)}
              />
              <Tile small label="Отправлено сегодня" value={`письма ${format(queue.today.email.sent)} · push ${format(queue.today.push.sent)}`} />
              <Tile small label="Не удалось сегодня" value={`письма ${format(queue.today.email.failed)} · push ${format(queue.today.push.failed)}`} />
            </Tiles>
          </>
        )}
      </Stack>

      {sms && (
        <Stack $gap={8}>
          <Heading>SMS (вход по телефону)</Heading>
          {smsAlerts(sms, now).map((alert) => (
            <Notice key={alert.text} tone={alert.tone}>
              {alert.text}
            </Notice>
          ))}
          {sms.configured && (
            <>
              <Tiles>
                <Tile label="Остаток на счёте" value={sms.balance.amount === null ? '—' : formatRub(sms.balance.amount)} />
                <Tile label="Хватит примерно на" value={smsLeft(sms) === null ? '—' : `${format(smsLeft(sms) ?? 0)} SMS`} />
                <Tile label="Отправлено сегодня" value={format(sms.today.sent)} />
                <Tile label="Потрачено сегодня" value={formatRub(sms.today.spend)} />
                <Tile small label="За 7 суток" value={`${format(sms.week.sent)} SMS · ${formatRub(sms.week.spend)}`} />
                <Tile small label="Не удалось сегодня" value={format(sms.today.failed)} />
                <Tile small label="Ждут отправки" value={`${format(sms.waiting)}${sms.retrying > 0 ? ` · повтор ${format(sms.retrying)}` : ''}`} />
                <Tile small label="Лимит за сутки (UTC)" value={sms.limit > 0 ? `${format(sms.usedToday)} из ${format(sms.limit)}` : format(sms.usedToday)} />
                <Tile small label="Остаток проверен" value={sms.balance.checkedSeconds === null ? '—' : `${formatAge(sms.balance.checkedSeconds)} назад`} />
              </Tiles>
              {sms.days.length > 0 && (
                <Tiles>
                  {sms.days.map((d) => (
                    <Tile small key={d.day} label={formatDay(d.day)} value={`${format(d.sent)} SMS · ${formatRub(d.spend)}${d.failed > 0 ? ` · ошибок ${format(d.failed)}` : ''}`} />
                  ))}
                </Tiles>
              )}
            </>
          )}
        </Stack>
      )}

      {queue?.scheduler && (
        <Stack $gap={8}>
          <Heading>Планировщик</Heading>
          <Tiles>
            <Tile small label="Состояние" value={queue.scheduler.alive ? 'работает' : 'не отвечает'} />
            <Tile small label="Последний проход" value={queue.scheduler.lastTickSeconds === null ? '—' : `${formatAge(queue.scheduler.lastTickSeconds)} назад`} />
            <Tile small label="Поставил в очередь" value={queue.scheduler.lastSent === null ? '—' : format(queue.scheduler.lastSent)} />
          </Tiles>
        </Stack>
      )}

      {queue?.realtime && (
        <Stack $gap={8}>
          <Heading>Живые обновления</Heading>
          <Tiles>
            <Tile small label="Состояние" value={queue.realtime.alive ? 'работает' : 'не отвечает'} />
            <Tile small label="Соединений сейчас" value={format(queue.realtime.connections)} />
          </Tiles>
        </Stack>
      )}

      {media && (
        <Stack $gap={8}>
          <Heading>Фото в чатах</Heading>
          {mediaAlerts(media).map((alert) => (
            <Notice key={alert.text} tone={alert.tone}>
              {alert.text}
            </Notice>
          ))}
          {media.configured && (
            <Tiles>
              <Tile small label="Сервис фото" value={media.alive ? 'работает' : 'не отвечает'} />
              <Tile label="Фото всего" value={format(media.photos)} />
              <Tile label="Занято места" value={formatBytes(media.bytes)} />
              <Tile small label="Не прикреплено к сообщениям" value={`${format(media.unattached.photos)} · ${formatBytes(media.unattached.bytes)}`} />
              <Tile small label="Больше всего у семьи" value={`${formatBytes(media.busiestFamilyBytes)} из ${formatBytes(media.quotaBytes)}`} />
            </Tiles>
          )}
        </Stack>
      )}
    </Screen>
  )
}
