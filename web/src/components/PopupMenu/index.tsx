import { useEffect, useRef, useState } from 'react'
import { Notice } from '@/components/Notice'
import { useInFlight } from '@/lib/useInFlight'
import { Check, Item, Menu, Message, Trigger, Wrap } from './styles'
import type { MenuAction, MenuButtonProps } from './types'

// Значок «три точки» с меню рядом: меню раскрывается под значком, как настоящее всплывающее меню (нижняя панель ActionSheet
// остаётся для долгого нажатия). Действие выполняется по нажатию, при успехе меню закрывается, при ошибке остаётся с сообщением.
// Escape и нажатие вне меню закрывают.
export function MenuButton({ actions, label = 'Меню' }: MenuButtonProps) {
  const guard = useInFlight()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = guard(async (action: MenuAction) => {
    setBusy(true)
    setError(undefined)
    try {
      await action.onSelect()
      setOpen(false)
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  })

  return (
    <Wrap ref={wrap}>
      <Trigger type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="5" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="12" cy="19" r="1.9" />
        </svg>
      </Trigger>
      {open && (
        <Menu role="menu">
          {actions.map((action) => (
            <Item
              key={action.key}
              type="button"
              role={action.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={action.checked}
              $danger={action.danger}
              disabled={busy}
              onClick={() => void run(action)}
            >
              {action.checked !== undefined && <Check $on={action.checked} aria-hidden>{action.checked ? '✓' : ''}</Check>}
              {action.label}
            </Item>
          ))}
          {error && (
            <Message>
              <Notice $tone="error">{error}</Notice>
            </Message>
          )}
        </Menu>
      )}
    </Wrap>
  )
}
