import { useState } from 'react'
import { getRobloxAvatar, type ProfilePatch } from '@/api'
import { BackLink } from '@/components/BackLink'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { dataUrlToFile, resizeToAvatar } from '@/lib/image'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useUpdateProfileMutation } from '@/store/profile'
import { AvatarEditor } from './components/AvatarEditor'
import { ProfileForm } from './components/ProfileForm'
import { describePhotoError } from './utils'
import { useInFlight } from '@/lib/useInFlight'

export default function ProfileEdit() {
  const guard = useInFlight()
  const { identity, save } = useIdentity()
  const { data } = useProfile()
  const [updateProfile] = useUpdateProfileMutation()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string>()

  if (!identity) return null
  const token = identity.token

  const changePhoto = guard(async (file: File | null) => {
    setPhotoBusy(true)
    setPhotoError(undefined)
    try {
      const avatar = file ? await resizeToAvatar(file) : null
      await updateProfile({ avatar }).unwrap().catch(toApiError)
    } catch (err) {
      setPhotoError(describePhotoError(err))
    } finally {
      setPhotoBusy(false)
    }
  })

  // аватар из Roblox: сервер отдаёт картинку, дальше как с обычным фото (обрезка до квадрата и сжатие)
  const takeRobloxAvatar = guard(async (username: string) => {
    setPhotoBusy(true)
    setPhotoError(undefined)
    try {
      const { image } = await getRobloxAvatar(token, username)
      const avatar = await resizeToAvatar(dataUrlToFile(image, 'roblox.png'))
      await updateProfile({ avatar }).unwrap().catch(toApiError)
    } catch (err) {
      setPhotoError(describePhotoError(err))
      throw err
    } finally {
      setPhotoBusy(false)
    }
  })

  async function saveProfile(patch: ProfilePatch) {
    await updateProfile(patch).unwrap().catch(toApiError)
    // имя хранится и на устройстве (приветствие, шапка), поэтому обновляем и его
    if (patch.name && identity) await save({ ...identity, name: patch.name })
  }

  if (!data) return <Page><BackLink to="/profile">← Профиль</BackLink><h1>Изменить профиль</h1><p>Загрузка…</p></Page>

  return (
    <Page>
      <BackLink to="/profile">← Профиль</BackLink>
      <h1>Изменить профиль</h1>
      <AvatarEditor
        name={data.me.name}
        seed={data.me.id}
        avatar={data.me.avatar}
        busy={photoBusy}
        error={photoError}
        onPick={(file) => changePhoto(file)}
        onRemove={() => changePhoto(null)}
        onRoblox={data.me.role === 'child' ? takeRobloxAvatar : undefined}
      />

      <ProfileForm name={data.me.name} birthDate={data.me.birthDate} onSave={saveProfile} />
    </Page>
  )
}
