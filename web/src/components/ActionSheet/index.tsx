import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Notice } from '@/components/Notice'
import { useInFlight } from '@/lib/useInFlight'
import { Backdrop, Heading, Item, Message, Sheet } from './styles'
import type { ActionSheetProps, SheetAction } from './types'

// Меню действий внизу экрана (три точки в шапке, долгое нажатие в списке). Действие выполняется по нажатию, при успехе меню
// закрывается, при ошибке остаётся с сообщением. Escape и нажатие на затемнение закрывают.
export function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheet.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

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

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <Backdrop onClick={onClose} onKeyDown={onKeyDown}>
      <Sheet ref={sheet} role="dialog" aria-modal="true" aria-label={title ?? 'Действия'} onClick={(e) => e.stopPropagation()}>
        {title && <Heading>{title}</Heading>}
        {actions.map((action) => (
          <Item key={action.key} type="button" $danger={action.danger} disabled={busy} onClick={() => void run(action)}>
            {action.label}
          </Item>
        ))}
        {error && (
          <Message>
            <Notice $tone="error">{error}</Notice>
          </Message>
        )}
      </Sheet>
    </Backdrop>
  )
}
