import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useIdentity } from '@/identity/context'
import { ProfileContext } from './context'
import type { ProfileData } from './types'
import { fetchProfile, type ProfileResult } from './utils'

// Запрос /me для всех разделов: из него берутся фото в углу, имя, участники семьи.
// Данные обновляются при каждом переходе и при возврате на вкладку, иначе чужие правки
// (например, ребёнок поменял фото или дату рождения) были бы видны только после перезагрузки.
export function ProfileProvider({ token, children }: { token: string; children: ReactNode }) {
  const { clear } = useIdentity()
  const { pathname } = useLocation()
  const [data, setData] = useState<ProfileData>()
  const [failed, setFailed] = useState(false)

  const apply = useCallback(
    (result: ProfileResult) => {
      if (result.status === 'ok') {
        setData(result.data)
        setFailed(false)
      } else if (result.status === 'unauthorized') {
        clear()
      } else {
        setFailed(true)
      }
    },
    [clear],
  )

  useEffect(() => {
    let cancelled = false
    fetchProfile(token).then((result) => !cancelled && apply(result))
    return () => { cancelled = true }
  }, [token, apply, pathname])

  const refresh = useCallback(async () => apply(await fetchProfile(token)), [token, apply])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return <ProfileContext value={{ data, failed, refresh }}>{children}</ProfileContext>
}
