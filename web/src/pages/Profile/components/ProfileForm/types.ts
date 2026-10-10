import type { ProfilePatch } from '@/api'

export interface ProfileFormProps {
  // текущие значения на сервере
  name: string
  birthDate?: string | null
  // получает только изменённые поля; должен бросить, если сохранить не удалось
  onSave: (patch: ProfilePatch) => Promise<void>
}
