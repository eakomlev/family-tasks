import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
import type { Member, Occurrence, Task } from '@/api'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Text } from '@/components/Text'
import { coinsWord } from '@/lib/coins'
import { formatDateTime } from '@/lib/date'
import { authorLabel, taskMeta } from './taskMeta'

type TaskState = 'todo' | 'done' | 'late' | 'pending'

const STATE_LABELS: Record<TaskState, string> = { todo: '', done: 'Выполнено: ', late: 'Просрочено: ', pending: 'На проверке: ' }

const Card = styled.View`
  border-radius: ${({ theme }) => theme.radiusCard}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
  shadow-color: #283278;
  shadow-opacity: ${({ theme }) => (theme.dark ? 0 : 0.08)};
  shadow-radius: 12px;
  shadow-offset: 0px 6px;
  elevation: ${({ theme }) => (theme.dark ? 0 : 2)};
`

const Badge = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  align-items: center;
  justify-content: center;
  background-color: ${({ $bg }) => $bg};
`

const Reward = styled.View<{ $done: boolean }>`
  padding: 4px 10px;
  border-radius: 999px;
  background-color: ${({ theme, $done }) => ($done ? theme.colors.doneBg : theme.colors.coinBg)};
`

export interface ReviewActions {
  onConfirm: () => void
  onReject: () => void
  busy?: boolean
}

interface TaskItemProps {
  task: Task
  occurrence: Occurrence
  // исполнитель: по нему подбирается подпись автора («от мамы» для ребёнка)
  assignee?: Member
  // писать имя исполнителя (не нужно, если список уже отфильтрован по нему)
  showAssignee?: boolean
  // автор; показываем «от …», только если он не исполнитель
  author?: Member
  // кто выполнил (для списка выполненных)
  doneBy?: Member
  // писать дату вхождения (в списке выполненных, где нет заголовков дней)
  showDate?: boolean
  // сегодняшняя дата YYYY-MM-DD: по ней определяется просрочка
  today: string
  // родителю у карточки «на проверке» показываем кнопки «Подтвердить» и «Вернуть»
  review?: ReviewActions
}

// Карточка задания: нажатие открывает страницу задания; значок показывает, выполнено ли оно, просрочено или ждёт проверки родителем
export function TaskItem({ task, occurrence, assignee, showAssignee, author, doneBy, showDate, today, review }: TaskItemProps) {
  const router = useRouter()
  const { colors } = useTheme()
  const done = occurrence.done !== null
  const pending = occurrence.pending !== null
  const { parts, late } = taskMeta(task, occurrence, today, showDate)
  const state: TaskState = done ? 'done' : pending ? 'pending' : late ? 'late' : 'todo'
  const from = authorLabel(author, assignee)

  const badge = {
    todo: { bg: colors.track, color: colors.checkBorder, icon: 'ellipse-outline' as const },
    done: { bg: colors.lime, color: colors.onLime, icon: 'checkmark' as const },
    late: { bg: colors.warningBg, color: colors.coinText, icon: 'time-outline' as const },
    pending: { bg: colors.reviewBg, color: colors.reviewText, icon: 'hourglass-outline' as const },
  }[state]

  const open = () => router.push({ pathname: '/tasks/[taskId]', params: occurrence.date ? { taskId: task.id, date: occurrence.date } : { taskId: task.id } })

  const metaLines = [
    pending ? (review ? 'Ждёт вашего подтверждения' : 'Ждёт подтверждения родителей') : null,
    ...parts,
    showAssignee && assignee ? assignee.name : null,
    from || null,
    doneBy && occurrence.done ? `выполнил(а): ${doneBy.name}, ${formatDateTime(occurrence.done.at)}` : null,
  ].filter((line): line is string => !!line)

  return (
    <Card>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${STATE_LABELS[state]}${task.title}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <Badge $bg={badge.bg}>
          <Ionicons name={badge.icon} size={22} color={badge.color} />
        </Badge>
        <View style={{ flex: 1, gap: 2 }}>
          <Text $weight="extraBold" $size={16} style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
            {task.title}
          </Text>
          {metaLines.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 }}>
              {showAssignee && assignee && <Avatar name={assignee.name} seed={assignee.id} src={assignee.avatar} size={18} />}
              <Text $size={13} $tone={late ? 'error' : 'muted'} style={{ flexShrink: 1 }}>
                {metaLines.join(' · ')}
              </Text>
            </View>
          )}
        </View>
        {task.reward > 0 ? (
          <Reward $done={done}>
            <Text $weight="black" $size={14} accessibilityLabel={coinsWord(task.reward)} style={{ color: done ? colors.doneText : colors.coinText }}>
              {`+${task.reward}`}
            </Text>
          </Reward>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        )}
      </Pressable>
      {review && pending && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Button variant="lime" disabled={review.busy} onPress={review.onConfirm}>
              {`Подтвердить${task.reward > 0 ? `: +${task.reward}` : ''}`}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button disabled={review.busy} onPress={review.onReject}>
              Вернуть
            </Button>
          </View>
        </View>
      )}
    </Card>
  )
}
