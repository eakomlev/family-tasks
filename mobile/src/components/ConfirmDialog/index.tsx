import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal } from 'react-native'
import styled from 'styled-components/native'
import { Button } from '../Button'
import { Stack } from '../Stack'
import { Heading, Text } from '../Text'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  // опасное действие (удаление): кнопка подтверждения красная
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

const Overlay = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(10, 12, 30, 0.6);
`

const Box = styled.View`
  width: 100%;
  max-width: 380px;
  padding: 22px;
  border-radius: 26px;
  background-color: ${({ theme }) => theme.colors.surface};
`

// Окно подтверждения вместо системного: `await confirm({ title, message, confirmLabel, danger })` даёт true или false
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    // новый вопрос закрывает прежний отказом
    resolver.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOptions(next)
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Modal visible={options !== null} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Overlay>
          <Box accessibilityViewIsModal>
            <Stack>
              <Heading>{options?.title}</Heading>
              {options?.message ? <Text $tone="muted">{options.message}</Text> : null}
              <Button variant={options?.danger ? 'danger' : 'primary'} onPress={() => close(true)}>
                {options?.confirmLabel ?? 'Да'}
              </Button>
              <Button onPress={() => close(false)}>Отмена</Button>
            </Stack>
          </Box>
        </Overlay>
      </Modal>
    </ConfirmContext>
  )
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}
