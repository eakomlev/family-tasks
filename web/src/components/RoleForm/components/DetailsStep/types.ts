import type { Role } from '@/lib/roles'

export interface DetailsStepProps {
  roles: Role[]
  role: Role | null
  name: string
  email: string
  busy: boolean
  ready: boolean
  error?: string
  onRoleChange: (role: Role) => void
  onNameChange: (name: string) => void
  onEmailChange: (email: string) => void
  onSubmit: () => void
}
