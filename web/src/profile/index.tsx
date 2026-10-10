import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useIdentity } from '@/identity/context'
import { ProfileContext } from './context'
import type { ProfileData } from './types'
import { fetchProfile, type ProfileResult } from './utils'

// один запрос /me на все разделы: из него берутся фото в углу, имя, участники семьи
export function ProfileProvider({ token, children }: { token: string; children: ReactNode }) {
  const { clear } = useIdentity()
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
  }, [token, apply])

  const refresh = useCallback(async () => apply(await fetchProfile(token)), [token, apply])

  return <ProfileContext value={{ data, failed, refresh }}>{children}</ProfileContext>
}
