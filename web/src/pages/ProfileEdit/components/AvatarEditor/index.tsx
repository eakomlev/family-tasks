import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Buttons, HiddenInput, RobloxForm, Wrapper } from './styles'
import type { AvatarEditorProps } from './types'

export function AvatarEditor({ name, seed, avatar, busy, error, onPick, onRemove, onRoblox }: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [robloxOpen, setRobloxOpen] = useState(false)
  const [username, setUsername] = useState('')

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // сбрасываем значение, чтобы тот же файл можно было выбрать повторно
    e.target.value = ''
    if (file) onPick(file)
  }

  async function submitRoblox(e: FormEvent) {
    e.preventDefault()
    if (!onRoblox || !username.trim()) return
    try {
      await onRoblox(username.trim())
      setRobloxOpen(false)
      setUsername('')
    } catch {
      // ошибку показывает родитель (error), форма остаётся открытой
    }
  }

  return (
    <Wrapper>
      <Avatar name={name} seed={seed} src={avatar} size="6rem" />
      <Buttons>
        <Button $variant="text" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {avatar ? 'Изменить фото' : 'Загрузить фото'}
        </Button>
        {onRoblox && (
          <Button $variant="text" type="button" disabled={busy} onClick={() => setRobloxOpen((open) => !open)}>
            Аватар из Roblox
          </Button>
        )}
        {avatar && (
          <Button $variant="text" type="button" disabled={busy} onClick={onRemove}>Удалить фото</Button>
        )}
      </Buttons>
      {onRoblox && robloxOpen && (
        <RobloxForm onSubmit={submitRoblox}>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ник в Roblox"
            aria-label="Ник в Roblox"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
          />
          <Button $variant="primary" type="submit" disabled={busy || !username.trim()}>
            {busy ? 'Загружаем…' : 'Взять аватар'}
          </Button>
        </RobloxForm>
      )}
      <HiddenInput ref={inputRef} type="file" accept="image/*" onChange={handleChange} />
      {error && <Notice $tone="error">{error}</Notice>}
    </Wrapper>
  )
}
