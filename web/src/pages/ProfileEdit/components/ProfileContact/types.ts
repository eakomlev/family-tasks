export interface ProfileContactProps {
  // уже указанные способы связи (null или пусто: ещё нет)
  email: string | null
  phone?: string | null
  token: string
  // после подтверждения: обновить профиль
  onSaved: () => void
}
