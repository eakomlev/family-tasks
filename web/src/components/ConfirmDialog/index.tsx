import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { ConfirmContext } from './context'
import { Actions, Dialog, Overlay } from './styles'
import type { ConfirmFn, ConfirmOptions } from './types'

interface Pending {
  options: ConfirmOptions
  resolve: (ok: boolean) => void
}

// Окно подтверждения на всю страницу вместо системного window.confirm.
// Фокус сначала на «Отмена» (случайный Enter ничего не сломает), Esc отменяет, Tab ходит только по кнопкам окна.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const close = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok)
    pendingRef.current = null
    setPending(null)
  }, [])

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // второе окно поверх первого не открываем: первое считается отменённым
        pendingRef.current?.resolve(false)
        pendingRef.current = { options, resolve }
        setPending(pendingRef.current)
      }),
    [],
  )

  // на время показа: фокус в окне, страница позади не прокручивается; после закрытия фокус возвращается
  useEffect(() => {
    if (!pending) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [pending])

  // не оставляем безответное обещание, если провайдер убрали
  useEffect(() => () => pendingRef.current?.resolve(false), [])

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close(false)
      return
    }
    if (e.key !== 'Tab') return
    const first = cancelRef.current
    const last = confirmRef.current
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  const options = pending?.options

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Overlay role="alertdialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
          <Dialog>
            <h2 id={titleId}>{options.title}</h2>
            {options.message && <p>{options.message}</p>}
            <Actions>
              <Button ref={cancelRef} type="button" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Отмена'}
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                $variant={options.danger ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {options.confirmLabel}
              </Button>
            </Actions>
          </Dialog>
        </Overlay>
      )}
    </ConfirmContext.Provider>
  )
}
