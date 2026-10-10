import { Hint, Label } from './styles'
import type { FieldProps } from './types'

export function Field({ label, hint, children }: FieldProps) {
  return (
    <Label>
      {label}
      {children}
      {hint && <Hint>{hint}</Hint>}
    </Label>
  )
}
