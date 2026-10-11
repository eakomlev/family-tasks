import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { Confetti } from '@/components/Confetti'
import { Content, Emoji, Overlay } from './styles'
import type { CelebrationProps } from './types'
import { EMOJIS, PRAISES, pick } from './utils'

// Экран поздравления на всю страницу после выполнения задания, с конфетти.
export function Celebration({ title, onClose }: CelebrationProps) {
  const [praise] = useState(() => pick(PRAISES))
  const [emoji] = useState(() => pick(EMOJIS))
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    button.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <Overlay role="dialog" aria-modal="true" aria-labelledby="celebration-title" onKeyDown={onKeyDown}>
      <Confetti />
      <Content>
        <Emoji aria-hidden>{emoji}</Emoji>
        <h1 id="celebration-title">{praise}</h1>
        <p>Задание «{title}» выполнено.</p>
        <Button ref={button} $variant="primary" type="button" onClick={onClose}>
          Отлично
        </Button>
      </Content>
    </Overlay>
  )
}
