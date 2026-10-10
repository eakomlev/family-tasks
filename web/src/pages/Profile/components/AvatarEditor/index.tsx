import { useRef, type ChangeEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Buttons, HiddenInput, Wrapper } from './styles'
import type { AvatarEditorProps } from './types'

export function AvatarEditor({ name, seed, avatar, busy, error, onPick, onRemove }: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // сбрасываем значение, чтобы тот же файл можно было выбрать повторно
    e.target.value = ''
    if (file) onPick(file)
  }

  return (
    <Wrapper>
      <Avatar name={name} seed={seed} src={avatar} size="6rem" />
      <Buttons>
        <Button $variant="text" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {avatar ? 'Изменить фото' : 'Загрузить фото'}
        </Button>
        {avatar && (
          <Button $variant="text" type="button" disabled={busy} onClick={onRemove}>Удалить фото</Button>
        )}
      </Buttons>
      <HiddenInput ref={inputRef} type="file" accept="image/*" onChange={handleChange} />
      {error && <Notice $tone="error">{error}</Notice>}
    </Wrapper>
  )
}
