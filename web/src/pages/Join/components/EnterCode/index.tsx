import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Stack } from '@/components/Stack'
import { extractCode } from './utils'

export function EnterCode() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const code = extractCode(value)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code) navigate(`/join?code=${encodeURIComponent(code)}`)
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <p>Вставьте ссылку-приглашение или её код.</p>
      <Field label="Приглашение">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…/join?code=…" />
      </Field>
      <Button $variant="primary" type="submit" disabled={!code}>Продолжить</Button>
    </Stack>
  )
}
