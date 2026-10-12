import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Notice } from '@/components/Notice'
import { canSend, MAX_LENGTH } from '../../utils'
import { Bar, Field, SendButton } from './styles'
import type { ComposerProps } from './types'

// Поле ввода сообщения: растёт по мере набора, Enter отправляет, Shift+Enter переносит строку.
export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)

  // высота по содержимому
  useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const shiftRef = useRef(false)
  const submitRef = useRef<() => Promise<void>>(async () => {})

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (busy || !canSend(text)) return
    setBusy(true)
    setFailed(false)
    try {
      await onSend(text.trim())
      setText('')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
      field.current?.focus()
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    // при вводе через экранную клавиатуру (composition) Enter подтверждает слово, а не отправляет
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  // мобильные клавиатуры не всегда присылают keydown с Enter: ловим вставку разрыва строки до того, как она случится
  useEffect(() => {
    submitRef.current = submit
  })

  useEffect(() => {
    const el = field.current
    if (!el) return
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'insertLineBreak' && !e.isComposing && !shiftRef.current) {
        e.preventDefault()
        void submitRef.current()
      }
    }
    // Shift+Enter (физическая клавиатура) остаётся переносом строки
    const onKey = (e: globalThis.KeyboardEvent) => {
      shiftRef.current = e.shiftKey
    }
    el.addEventListener('beforeinput', onBeforeInput)
    el.addEventListener('keydown', onKey)
    el.addEventListener('keyup', onKey)
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput)
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('keyup', onKey)
    }
  }, [])

  return (
    <>
      {failed && <Notice $tone="error">Не удалось отправить сообщение. Попробуйте ещё раз.</Notice>}
      <Bar onSubmit={submit}>
        <Field
          ref={field}
          value={text}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Сообщение"
          aria-label="Сообщение"
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value)
            setFailed(false)
          }}
          onKeyDown={onKeyDown}
        />
        <SendButton type="submit" aria-label="Отправить" disabled={busy || !canSend(text)}>
          <svg viewBox="0 0 24 24" aria-hidden focusable="false">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </SendButton>
      </Bar>
    </>
  )
}
