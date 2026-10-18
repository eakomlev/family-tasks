import { useEffect, type ReactNode } from 'react'
import { useIdentity } from '@/identity/context'
import { useGetMeQuery } from '@/store/profile'
import { ProfileContext } from './context'

// Профиль для всех разделов (фото в углу, имя, участники семьи) из кэша RTK Query: из сохранённого на устройстве показывается сразу,
// свежее приходит следом. Обновляется по сигналу `members` с сервера (RealtimeBridge инвалидирует тег Me), при возврате на вкладку
// и при открытии, если данные старше 30 секунд; изменения профиля (мутации) обновляют кэш сами.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { clear } = useIdentity()
  const { data, error, isError } = useGetMeQuery()

  // токен больше не действителен (например, сессию отозвали): выходим
  const unauthorized = !!error && 'status' in error && error.status === 401
  useEffect(() => {
    if (unauthorized) void clear()
  }, [unauthorized, clear])

  return <ProfileContext value={{ data, failed: isError && !unauthorized }}>{children}</ProfileContext>
}
