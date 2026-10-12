import { useState, type FormEvent } from 'react'
import type { ProfilePatch } from '@/api'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { ageFromBirthDate, formatAge, todayIso } from '@/lib/date'
import type { ProfileFormProps } from './types'
import { describeSaveError } from './utils'

const MIN_BIRTH_DATE = '1900-01-01'

export function ProfileForm({ name, birthDate, onSave }: ProfileFormProps) {
  const [nameValue, setNameValue] = useState(name)
  // пустая строка — даты нет
  const [birthValue, setBirthValue] = useState(birthDate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  const trimmed = nameValue.trim()
  const nameChanged = trimmed !== name
  const birthChanged = birthValue !== (birthDate ?? '')
  const ready = (nameChanged || birthChanged) && trimmed.length > 0 && !busy

  function edit(update: () => void) {
    update()
    setSaved(false)
    setError(undefined)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    const patch: ProfilePatch = {}
    if (nameChanged) patch.name = trimmed
    if (birthChanged) patch.birthDate = birthValue || null

    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      await onSave(patch)
      setNameValue(trimmed)
      setSaved(true)
    } catch (err) {
      setError(describeSaveError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <Field label="Имя">
        <Input
          value={nameValue}
          onChange={(e) => edit(() => setNameValue(e.target.value))}
          maxLength={40}
          autoComplete="given-name"
        />
      </Field>

      <Field label="Дата рождения" hint={birthValue ? formatAge(ageFromBirthDate(birthValue)) : undefined}>
        <Input
          type="date"
          value={birthValue}
          min={MIN_BIRTH_DATE}
          max={todayIso()}
          onChange={(e) => edit(() => setBirthValue(e.target.value))}
          autoComplete="bday"
        />
      </Field>
      {birthValue && (
        <Button $variant="text" type="button" onClick={() => edit(() => setBirthValue(''))}>
          Убрать дату рождения
        </Button>
      )}

      {error && <Notice $tone="error">{error}</Notice>}
      {saved && <Notice $tone="muted">Сохранено.</Notice>}
      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </Button>
    </Stack>
  )
}
