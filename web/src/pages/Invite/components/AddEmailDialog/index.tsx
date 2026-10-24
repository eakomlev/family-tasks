import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Backdrop, Dialog, ErrorText } from './styles'

interface AddEmailDialogProps {
  // добавляет адрес; возвращает текст ошибки, если адрес не подошёл (тогда окно остаётся открытым)
  onAdd: (email: string) => string | undefined
  onClose: () => void
}

// Небольшое окно для ввода адреса: «Добавить» проверяет адрес и закрывает окно, неверный адрес остаётся в поле с подсказкой.
export function AddEmailDialog({ onAdd, onClose }: AddEmailDialogProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => previous?.focus?.()
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    const problem = onAdd(value)
    if (problem) setError(problem)
    else onClose()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <Backdrop onClick={onClose} onKeyDown={onKeyDown}>
      <Dialog role="dialog" aria-modal="true" aria-label="Добавить адрес" noValidate onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>Добавить адрес</h2>
        <Input
          ref={input}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@example.com"
          aria-label="Email приглашаемого"
          value={value}
          maxLength={254}
          onChange={(e) => {
            setValue(e.target.value)
            setError(undefined)
          }}
        />
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <Button $variant="primary" type="submit" disabled={!value.trim()}>
          Добавить
        </Button>
        <Button type="button" onClick={onClose}>
          Отмена
        </Button>
      </Dialog>
    </Backdrop>
  )
}
