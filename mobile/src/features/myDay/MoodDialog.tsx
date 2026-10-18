import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import styled from 'styled-components/native'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Heading, Text } from '@/components/Text'
import { MOODS } from '@/lib/mood'
import { useInFlight } from '@/lib/useInFlight'

const Overlay = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(10, 12, 30, 0.6);
`

const Dialog = styled.View`
  width: 100%;
  max-width: 380px;
  gap: 14px;
  padding: 22px;
  border-radius: 26px;
  background-color: ${({ theme }) => theme.colors.surface};
`

const Choice = styled(Pressable)<{ $active: boolean }>`
  flex: 1;
  align-items: center;
  gap: 4px;
  padding: 10px 2px;
  border-radius: 16px;
  border-width: 2px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.accent : 'transparent')};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.accentSoft : theme.colors.bg)};
`

interface MoodDialogProps {
  current?: number
  // утром окно открывается принудительно: пока настроение не выбрано, закрыть его нельзя
  forced: boolean
  // должен бросить ошибку, если сохранить не удалось
  onPick: (value: number) => Promise<void>
  onClose: () => void
}

// «Как твоё настроение?»: пять эмоций от радости до грусти
export function MoodDialog({ current, forced, onPick, onClose }: MoodDialogProps) {
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const pick = guard(async (value: number) => {
    setBusy(true)
    setError(undefined)
    try {
      await onPick(value)
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Modal transparent animationType="fade" onRequestClose={() => { if (!forced) onClose() }}>
      <Overlay>
        <Dialog accessibilityViewIsModal>
          <Heading>Как твоё настроение?</Heading>
          <Text $tone="muted">{forced ? 'Выбери, как ты себя чувствуешь сегодня.' : 'Можно изменить, если оно поменялось.'}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {MOODS.map((mood) => (
              <Choice
                key={mood.value}
                $active={current === mood.value}
                disabled={busy}
                onPress={() => void pick(mood.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: current === mood.value }}
              >
                <Text $size={30}>{mood.emoji}</Text>
                <Text $size={11} $weight="bold" $tone="muted">
                  {mood.label}
                </Text>
              </Choice>
            ))}
          </View>
          {error && <Notice tone="error">{error}</Notice>}
          {!forced && (
            <Button disabled={busy} onPress={onClose}>
              Отмена
            </Button>
          )}
        </Dialog>
      </Overlay>
    </Modal>
  )
}
