import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { CoinPicker } from '@/components/CoinPicker'
import { Notice } from '@/components/Notice'
import { MAX_REWARD } from '@/lib/coins'
import { REACTIONS } from '@/lib/reactions'
import { Backdrop, Emoji, Emojis, Quote, Sheet, Title } from './styles'
import type { FeedbackDialogProps } from './types'

// Окно родителя над сообщением ребёнка: выбрать реакцию и/или начислить монеты автору.
export function FeedbackDialog({ message, authorName, myEmoji, onSubmit, onClose }: FeedbackDialogProps) {
  // выбранная реакция: undefined — не выбрана (у сообщения нет моей), строка — выбрана
  const [emoji, setEmoji] = useState<string | undefined>(myEmoji)
  const [coins, setCoins] = useState('0')
  const [custom, setCustom] = useState(false)
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

  const amount = Number(coins)
  const coinsInvalid = custom && (coins.trim() === '' || !Number.isInteger(amount) || amount < 1 || amount > MAX_REWARD)
  const coinsChosen = !coinsInvalid && amount > 0
  // реакция изменилась: поставлена новая или снята прежняя
  const emojiChanged = emoji !== myEmoji
  const canSend = !busy && !coinsInvalid && (coinsChosen || emojiChanged)

  // повторное нажатие на выбранную реакцию снимает её
  const pick = (value: string) => {
    setEmoji((current) => (current === value ? undefined : value))
    setError(undefined)
  }

  async function submit() {
    if (!canSend) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit({
        ...(emojiChanged ? { emoji: emoji ?? null } : {}),
        ...(coinsChosen ? { coins: amount } : {}),
      })
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
      setBusy(false)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  const preview = message.text.length > 120 ? `${message.text.slice(0, 119)}…` : message.text

  return (
    <Backdrop onClick={onClose} onKeyDown={onKeyDown}>
      <Sheet
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="feedback-title">Сообщение: {authorName}</h2>
        <Quote>{preview}</Quote>

        <div role="group" aria-label="Реакция">
          <Title>Реакция</Title>
          <Emojis>
            {REACTIONS.map((r) => (
              <Emoji key={r} type="button" $active={emoji === r} aria-pressed={emoji === r} aria-label={`Реакция ${r}`} onClick={() => pick(r)}>
                {r}
              </Emoji>
            ))}
          </Emojis>
        </div>

        <CoinPicker
          value={coins}
          custom={custom}
          onChange={(value, isCustom) => {
            setCoins(value)
            setCustom(isCustom)
            setError(undefined)
          }}
          label="Монеты"
          title="Начислить монеты"
          zeroLabel="Без монет"
          hint={`Монеты получит ${authorName}. Начислять можно несколько раз.`}
        />

        {coinsInvalid && <Notice $tone="error">Монеты: целое число от 1 до {MAX_REWARD}.</Notice>}
        {error && <Notice $tone="error">{error}</Notice>}

        <Button $variant="primary" type="button" disabled={!canSend} onClick={() => void submit()}>
          {busy ? 'Отправляем…' : 'Отправить'}
        </Button>
        <Button type="button" disabled={busy} onClick={onClose}>Отмена</Button>
      </Sheet>
    </Backdrop>
  )
}
