import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CoinIcon } from '@/components/CoinBalance'
import { Notice } from '@/components/Notice'
import { REWARD_CHOICES } from '@/lib/coins'
import { REACTIONS } from '@/lib/reactions'
import { Backdrop, CoinButton, Coins, Emoji, Emojis, Sheet } from './styles'
import type { FeedbackDialogProps } from './types'
import { useInFlight } from '@/lib/useInFlight'

// быстрые суммы монет (без «0 — без награды»)
const COIN_CHOICES = REWARD_CHOICES.filter((n) => n > 0)

// Компактное окно над сообщением (открывается долгим нажатием): реакция и, если это родитель и сообщение ребёнка, монеты автору.
// Выбор применяется сразу, кнопки «Отправить» нет: повторное нажатие на свою реакцию снимает её.
export function FeedbackDialog({ authorName, canAward, myEmoji, onSubmit, onClose }: FeedbackDialogProps) {
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

  const apply = guard(async (feedback: Parameters<typeof onSubmit>[0]) => {
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

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <Backdrop onClick={onClose} onKeyDown={onKeyDown}>
      <Sheet ref={sheet} role="dialog" aria-modal="true" aria-label="Реакция на сообщение" onClick={(e) => e.stopPropagation()}>
        <Emojis role="group" aria-label="Реакция">
          {REACTIONS.map((r) => (
            <Emoji
              key={r}
              type="button"
              $active={myEmoji === r}
              aria-pressed={myEmoji === r}
              aria-label={`Реакция ${r}`}
              disabled={busy}
              onClick={() => void apply({ emoji: myEmoji === r ? null : r })}
            >
              {r}
            </Emoji>
          ))}
        </Emojis>

        {canAward && (
          <Coins role="group" aria-label="Монеты">
            <small>Монеты: {authorName}</small>
            <div>
              {COIN_CHOICES.map((n) => (
                <CoinButton key={n} type="button" aria-label={`Начислить ${n} монет`} disabled={busy} onClick={() => void apply({ coins: n })}>
                  <CoinIcon />+{n}
                </CoinButton>
              ))}
            </div>
          </Coins>
        )}

        {error && <Notice $tone="error">{error}</Notice>}
      </Sheet>
    </Backdrop>
  )
}
