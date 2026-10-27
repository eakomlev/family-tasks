import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import styled, { useTheme } from 'styled-components/native'
import type { Member, Occurrence, Task } from '@/api'
import { ActionSheet } from '@/components/ActionSheet'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { coinsWord } from '@/lib/coins'
import { formatDateTime } from '@/lib/date'
import { hapticMenu } from '@/lib/haptics'
import { toApiError } from '@/store/api'
import { useDeleteTaskMutation } from '@/store/tasks'
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

// Карточка задания: нажатие открывает страницу задания; слева фото исполнителя, значок на нём показывает, выполнено ли задание, просрочено или ждёт проверки родителем
export function TaskItem({ task, occurrence, assignee, showAssignee, author, doneBy, showDate, today, review }: TaskItemProps) {
  const router = useRouter()
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const confirm = useConfirm()
  const [deleteTask] = useDeleteTaskMutation()
  const [menu, setMenu] = useState(false)
  // менять и удалять может только автор
  const canManage = !!identity && task.authorId === identity.memberId
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

  async function remove() {
    const ok = await confirm({ title: 'Удалить задание?', message: task.title, confirmLabel: 'Удалить', danger: true })
    if (ok) await deleteTask(task.id).unwrap().catch(toApiError)
  }

  const open = () => router.push({ pathname: '/tasks/[taskId]', params: occurrence.date ? { taskId: task.id, date: occurrence.date } : { taskId: task.id } })

  // вторая строка: срок, время и повтор, потом через запятую имя исполнителя («10:00, Миша»), дальше остальные пометки
  const line = [...parts, ...(showAssignee && assignee ? [assignee.name] : [])].join(', ')
  const metaLines = [
    pending ? (review ? 'Ждёт вашего подтверждения' : 'Ждёт подтверждения родителей') : null,
    line || null,
    from || null,
    doneBy && occurrence.done ? `выполнил(а): ${doneBy.name}, ${formatDateTime(occurrence.done.at)}` : null,
  ].filter((line): line is string => !!line)

  return (
    <Card>
      <Pressable
        onPress={open}
        onLongPress={
          canManage
            ? () => {
                hapticMenu()
                setMenu(true)
              }
            : undefined
        }
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityHint={canManage ? 'Удерживайте, чтобы изменить или удалить' : undefined}
        accessibilityLabel={`${STATE_LABELS[state]}${task.title}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        {assignee ? (
          // фото исполнителя: сразу видно, чьё задание; состояние (выполнено, просрочено, на проверке) отмечено значком на углу фото
          <View>
            <Avatar name={assignee.name} seed={assignee.id} src={assignee.avatar} size={44} />
            {state !== 'todo' && (
              <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: badge.bg, borderWidth: 2, borderColor: colors.surface }}>
                <Ionicons name={badge.icon} size={12} color={badge.color} />
              </View>
            )}
          </View>
        ) : (
          <Badge $bg={badge.bg}>
            <Ionicons name={badge.icon} size={22} color={badge.color} />
          </Badge>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text $weight="extraBold" $size={16} style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
            {task.title}
          </Text>
          {metaLines.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 }}>
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
      {menu && (
        <ActionSheet
          title={task.title}
          onClose={() => setMenu(false)}
          actions={[
            { key: 'edit', label: 'Изменить', onSelect: () => router.push({ pathname: '/tasks/[taskId]/edit', params: { taskId: task.id } }) },
            { key: 'delete', label: 'Удалить', danger: true, onSelect: remove },
          ]}
        />
      )}
    </Card>
  )
}
