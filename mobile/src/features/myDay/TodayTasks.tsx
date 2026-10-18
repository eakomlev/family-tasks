import { View } from 'react-native'
import { Card } from '@/components/Card'
import { Heading, Text } from '@/components/Text'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { todayIso } from '@/lib/date'
import { byTimeThenTitle, occurrenceKey, toEntries } from '@/lib/occurrences'
import { useListTasksQuery } from '@/store/tasks'

type Entry = ReturnType<typeof toEntries>[number]

function statusOf(entry: Entry, today: string): string {
  if (entry.occurrence.done) return '✅'
  if (entry.occurrence.pending) return '⏳'
  if (entry.occurrence.date && entry.occurrence.date < today) return '🕒'
  return '⚪'
}

// Мои задания на сегодня, просроченные и без срока. Полная карточка с переходом на страницу задания появится вместе с разделом «Задачи».
export function TodayTasks({ now }: { now: Date }) {
  const { identity } = useIdentity()
  const today = todayIso(now)
  const me = identity?.memberId
  const { data: list, isError } = useListTasksQuery({ from: today, to: today })
  const failed = isError && !list

  const all = list && me ? toEntries(list, me) : []
  // у ребёнка выполненные (подтверждённые) задания на этой странице не показываем: остаётся то, что ещё надо сделать
  const hideDone = identity?.role === 'child'
  const mine = hideDone ? all.filter(({ occurrence }) => occurrence.done === null) : all
  const allDone = hideDone && all.length > 0 && mine.length === 0
  // сначала просроченные, потом сегодняшние по времени, в конце без срока; будущие дни здесь не показываем
  const rank = (entry: Entry) => (entry.occurrence.date === null ? 2 : entry.occurrence.date < today ? 0 : 1)
  const items = mine
    .filter(({ occurrence }) => occurrence.date === null || occurrence.date <= today)
    .sort((a, b) => rank(a) - rank(b) || byTimeThenTitle(a, b))

  return (
    <Stack $gap={10}>
      <Heading>Задания на сегодня</Heading>
      {failed && <Notice tone="error">Не удалось загрузить задания. Проверьте соединение.</Notice>}
      {!list && !failed && <Text $tone="muted">Загрузка…</Text>}
      {list && items.length === 0 && (
        <Notice>{allDone ? 'Все задания на сегодня выполнены.' : 'Заданий на сегодня и без срока нет.'}</Notice>
      )}
      {items.map((entry) => (
        <Card key={occurrenceKey(entry.task.id, entry.occurrence.date)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text $size={22}>{statusOf(entry, today)}</Text>
          <View style={{ flex: 1 }}>
            <Text $weight="extraBold">{entry.task.title}</Text>
            <Text $size={13} $tone="muted">
              {[entry.task.time, entry.task.reward > 0 ? `+${coinsWord(entry.task.reward)}` : null].filter(Boolean).join(' · ') || 'Без срока'}
            </Text>
          </View>
        </Card>
      ))}
    </Stack>
  )
}
