import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import type { MessageFeedback } from '@/api'
import { CoinIcon } from '@/components/Coins'
import { Notice } from '@/components/Notice'
import { Text } from '@/components/Text'
import { REWARD_CHOICES } from '@/lib/coins'
import { REACTIONS } from '@/lib/reactions'
import { useInFlight } from '@/lib/useInFlight'

// быстрые суммы монет (без «0 — без награды»)
const COIN_CHOICES = REWARD_CHOICES.filter((n) => n > 0)

const Backdrop = styled(Pressable)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(10, 12, 30, 0.5);
`

const Sheet = styled.View`
  width: 100%;
  max-width: 380px;
  gap: 12px;
  padding: 16px;
  border-radius: 26px;
  background-color: ${({ theme }) => theme.colors.surface};
`

const Emoji = styled(Pressable)<{ $active: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $active }) => ($active ? theme.colors.accentSoft : 'transparent')};
`

const CoinButton = styled(Pressable)`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.coinBg};
`

interface FeedbackDialogProps {
  authorName: string
  // монеты может начислить только родитель и только за сообщение ребёнка
  canAward: boolean
  myEmoji?: string
  // должен бросить ошибку, если не удалось
  onSubmit: (feedback: MessageFeedback) => Promise<void>
  // действия над сообщением: ответить (любое), изменить и удалить (только своё); кнопки показываются, если действие передано
  onReply?: () => void
  // копировать и переслать текст сообщения (у сообщения только с вложениями кнопок нет); копирование должно бросить ошибку, если не удалось
  onCopy?: () => Promise<void>
  onForward?: () => void
  onEdit?: () => void
  // должен бросить ошибку, если не удалось
  onDelete?: () => Promise<void>
  onClose: () => void
}

const Row = styled(Pressable)`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 6px;
`

// Компактное окно над сообщением (открывается долгим нажатием): реакция и, если это родитель и сообщение ребёнка, монеты автору.
// Выбор применяется сразу, кнопки «Отправить» нет: повторное нажатие на свою реакцию снимает её.
export function FeedbackDialog({ authorName, canAward, myEmoji, onSubmit, onReply, onCopy, onForward, onEdit, onDelete, onClose }: FeedbackDialogProps) {
  const { colors } = useTheme()
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // удаление необратимо: первое нажатие просит подтвердить
  const [confirmDelete, setConfirmDelete] = useState(false)

  const apply = guard(async (feedback: MessageFeedback) => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit(feedback)
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  const copy = guard(async () => {
    if (busy || !onCopy) return
    setBusy(true)
    setError(undefined)
    try {
      await onCopy()
      onClose()
    } catch {
      setError('Не удалось скопировать.')
      setBusy(false)
    }
  })

  const remove = guard(async () => {
    if (busy || !onDelete) return
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy(true)
    setError(undefined)
    try {
      await onDelete()
    } catch {
      setError('Не удалось удалить. Попробуйте ещё раз.')
      setBusy(false)
      setConfirmDelete(false)
    }
  })

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Backdrop onPress={onClose}>
        <Pressable onPress={() => {}} style={{ width: '100%', alignItems: 'center' }}>
          <Sheet accessibilityViewIsModal accessibilityLabel="Реакция на сообщение">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
              {REACTIONS.map((r) => (
                <Emoji key={r} $active={myEmoji === r} disabled={busy} accessibilityRole="button" accessibilityLabel={`Реакция ${r}`} onPress={() => void apply({ emoji: myEmoji === r ? null : r })}>
                  <Text $size={26}>{r}</Text>
                </Emoji>
              ))}
            </View>

            {canAward && (
              <View style={{ gap: 8 }}>
                <Text $size={13} $tone="muted">{`Монеты: ${authorName}`}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COIN_CHOICES.map((n) => (
                    <CoinButton key={n} disabled={busy} accessibilityRole="button" accessibilityLabel={`Начислить ${n} монет`} onPress={() => void apply({ coins: n })}>
                      <CoinIcon size={18} />
                      <Text $weight="black" $size={14} style={{ color: colors.coinText }}>{`+${n}`}</Text>
                    </CoinButton>
                  ))}
                </View>
              </View>
            )}

            {(onReply || onCopy || onForward || onEdit || onDelete) && (
              <View>
                {onReply && (
                  <Row disabled={busy} accessibilityRole="button" onPress={onReply}>
                    <Ionicons name="arrow-undo-outline" size={22} color={colors.text} />
                    <Text $weight="bold">Ответить</Text>
                  </Row>
                )}
                {onCopy && (
                  <Row disabled={busy} accessibilityRole="button" onPress={() => void copy()}>
                    <Ionicons name="copy-outline" size={22} color={colors.text} />
                    <Text $weight="bold">Копировать</Text>
                  </Row>
                )}
                {onForward && (
                  <Row disabled={busy} accessibilityRole="button" onPress={onForward}>
                    <Ionicons name="arrow-redo-outline" size={22} color={colors.text} />
                    <Text $weight="bold">Переслать</Text>
                  </Row>
                )}
                {onEdit && (
                  <Row disabled={busy} accessibilityRole="button" onPress={onEdit}>
                    <Ionicons name="create-outline" size={22} color={colors.text} />
                    <Text $weight="bold">Изменить</Text>
                  </Row>
                )}
                {onDelete && (
                  <Row disabled={busy} accessibilityRole="button" onPress={() => void remove()}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                    <Text $weight="bold" style={{ color: colors.error }}>{confirmDelete ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить'}</Text>
                  </Row>
                )}
              </View>
            )}

            {error && <Notice tone="error">{error}</Notice>}
          </Sheet>
        </Pressable>
      </Backdrop>
    </Modal>
  )
}
