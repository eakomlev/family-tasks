import { useState } from 'react'
import { Modal, Pressable } from 'react-native'
import styled from 'styled-components/native'
import { useInFlight } from '@/lib/useInFlight'
import { Notice } from '../Notice'
import { Text } from '../Text'

export interface SheetAction {
  key: string
  label: string
  // опасное действие (удаление, очистка): красный текст
  danger?: boolean
  // должен бросить ошибку, если действие не удалось
  onSelect: () => void | Promise<void>
}

const Backdrop = styled(Pressable)`
  flex: 1;
  justify-content: flex-end;
  background-color: rgba(10, 12, 30, 0.5);
`

const Sheet = styled.View`
  gap: 4px;
  padding: 16px 16px 28px;
  border-top-left-radius: 26px;
  border-top-right-radius: 26px;
  background-color: ${({ theme }) => theme.colors.surface};
`

const Item = styled(Pressable)`
  min-height: 52px;
  justify-content: center;
  padding-horizontal: 12px;
  border-radius: 14px;
`

// Меню действий внизу экрана (три точки в шапке, долгое нажатие в списке). Действие выполняется по нажатию, при успехе меню
// закрывается, при ошибке остаётся с сообщением. Нажатие на затемнение закрывает.
export function ActionSheet({ title, actions, onClose }: { title?: string; actions: SheetAction[]; onClose: () => void }) {
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = guard(async (action: SheetAction) => {
    setBusy(true)
    setError(undefined)
    try {
      await action.onSelect()
      onClose()
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.')
      setBusy(false)
    }
  })

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Backdrop onPress={onClose}>
        {/* нажатие внутри панели не закрывает меню */}
        <Pressable onPress={() => {}}>
          <Sheet accessibilityViewIsModal accessibilityLabel={title ?? 'Действия'}>
            {title && (
              <Text $weight="extraBold" $size={13} $tone="muted" style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
                {title}
              </Text>
            )}
            {actions.map((action) => (
              <Item key={action.key} disabled={busy} onPress={() => void run(action)} accessibilityRole="button" style={{ opacity: busy ? 0.5 : 1 }}>
                <Text $weight="bold" $tone={action.danger ? 'error' : 'default'}>
                  {action.label}
                </Text>
              </Item>
            ))}
            {error && <Notice tone="error">{error}</Notice>}
          </Sheet>
        </Pressable>
      </Backdrop>
    </Modal>
  )
}
