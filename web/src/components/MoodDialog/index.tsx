import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { MOODS } from '@/lib/mood'
import { Choice, Choices, Dialog, Overlay } from './styles'
import type { MoodDialogProps } from './types'
import { useInFlight } from '@/lib/useInFlight'

// «Как настроение?»: пять эмоций от радости до грусти. Утром показывается принудительно (forced), потом открывается по нажатию на смайлик.
export function MoodDialog({ current, forced, onPick, onClose }: MoodDialogProps) {
  const guard = useInFlight()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

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
    <Overlay onKeyDown={(e) => !forced && e.key === 'Escape' && onClose()}>
      <Dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="mood-title">
        <h2 id="mood-title">Как твоё настроение?</h2>
        <p>{forced ? 'Выбери, как ты себя чувствуешь сегодня.' : 'Можно изменить, если оно поменялось.'}</p>
        <Choices>
          {MOODS.map((mood) => (
            <Choice key={mood.value} type="button" $active={current === mood.value} aria-pressed={current === mood.value} disabled={busy} onClick={() => void pick(mood.value)}>
              <span aria-hidden>{mood.emoji}</span>
              <span>{mood.label}</span>
            </Choice>
          ))}
        </Choices>
        {error && <Notice $tone="error">{error}</Notice>}
        {!forced && <Button type="button" disabled={busy} onClick={onClose}>Отмена</Button>}
      </Dialog>
    </Overlay>
  )
}
