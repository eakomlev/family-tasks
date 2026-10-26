import type { SignupData } from '@/api'
import type { Role } from '@/lib/roles'

export interface RoleFormProps {
  roles: Role[]
  submitLabel: string
  // должен бросить ApiError, если сервер отклонил запрос
  onSubmit: (data: SignupData) => Promise<void>
}

export type Step = 'details' | 'code'
