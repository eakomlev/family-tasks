import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import type { NameFormProps } from './types'

export function NameForm({ name, onSave }: NameFormProps) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  const trimmed = value.trim()
  const changed = trimmed !== name
  const ready = changed && trimmed.length > 0 && !busy

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      await onSave(trimmed)
      setValue(trimmed)
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'name_taken'
          ? 'В семье уже есть участник с таким именем. Выберите другое.'
          : 'Не удалось сохранить имя. Попробуйте ещё раз.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <Field label="Имя">
        <Input
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
          maxLength={40}
          autoComplete="given-name"
        />
      </Field>
      {error && <Notice $tone="error">{error}</Notice>}
      {saved && <Notice $tone="muted">Имя сохранено.</Notice>}
      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Сохраняем…' : 'Сохранить имя'}
      </Button>
    </Stack>
  )
}
