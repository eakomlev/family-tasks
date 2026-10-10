import { useState, type FormEvent } from 'react'
import { ROLE_LABELS, type Role } from '../roles'

interface Props {
  roles: Role[]
  submitLabel: string
  busy: boolean
  error?: string
  onSubmit: (role: Role, name: string) => void
}

export function RoleForm({ roles, submitLabel, busy, error, onSubmit }: Props) {
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')

  const ready = role !== null && name.trim().length > 0 && !busy

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (role && ready) onSubmit(role, name.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <fieldset className="roles">
        <legend>Кто вы в семье?</legend>
        {roles.map((r) => (
          <label key={r} className={`role-card${role === r ? ' selected' : ''}`}>
            <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        Ваше имя
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Например, Аня"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : submitLabel}
      </button>
    </form>
  )
}
