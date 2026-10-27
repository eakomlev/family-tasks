import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { getRobloxAvatar, type ProfilePatch } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { dataUrlToFile, resizeToAvatar } from '@/lib/image'
import { useProfile } from '@/profile/context'
import { api, toApiError } from '@/store/api'
import { useUpdateProfileMutation } from '@/store/profile'
import { AvatarEditor } from './components/AvatarEditor'
import { ProfileContact } from './components/ProfileContact'
import { ProfileForm } from './components/ProfileForm'
import { describePhotoError } from './utils'
import { useInFlight } from '@/lib/useInFlight'

export default function ProfileEdit() {
  const guard = useInFlight()
  const { identity, save } = useIdentity()
  const { data } = useProfile()
  const [updateProfile] = useUpdateProfileMutation()
  const dispatch = useDispatch()
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

  if (!data) return <Page><PageHeader to="/profile">Изменить профиль</PageHeader><p>Загрузка…</p></Page>

  return (
    <Page>
      <PageHeader to="/profile">Изменить профиль</PageHeader>
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

      {/* способы входа: указанные только читаются, недостающий добавляется здесь же (код из SMS или письма) */}
      <ProfileContact email={data.me.email} phone={data.me.phone} token={token} onSaved={() => dispatch(api.util.invalidateTags(['Me']))} />
    </Page>
  )
}
