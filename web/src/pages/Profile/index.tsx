import { useState } from 'react'
import { updateProfile, type ProfilePatch } from '@/api'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { resizeToAvatar } from '@/lib/image'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { AvatarEditor } from './components/AvatarEditor'
import { ProfileForm } from './components/ProfileForm'
import { describePhotoError } from './utils'

export default function Profile() {
  const { identity, save } = useIdentity()
  const { data, refresh } = useProfile()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string>()

  if (!identity) return null
  const token = identity.token

  async function changePhoto(file: File | null) {
    setPhotoBusy(true)
    setPhotoError(undefined)
    try {
      const avatar = file ? await resizeToAvatar(file) : null
      await updateProfile(token, { avatar })
      await refresh()
    } catch (err) {
      setPhotoError(describePhotoError(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  async function saveProfile(patch: ProfilePatch) {
    await updateProfile(token, patch)
    // имя хранится и на устройстве (приветствие, шапка), поэтому обновляем и его
    if (patch.name && identity) await save({ ...identity, name: patch.name })
    await refresh()
  }

  if (!data) return <Page><h1>Профиль</h1><p>Загрузка…</p></Page>

  return (
    <Page>
      <h1>Профиль</h1>
      <AvatarEditor
        name={data.me.name}
        seed={data.me.id}
        avatar={data.me.avatar}
        busy={photoBusy}
        error={photoError}
        onPick={(file) => changePhoto(file)}
        onRemove={() => changePhoto(null)}
      />

      <ProfileForm name={data.me.name} birthDate={data.me.birthDate} onSave={saveProfile} />

      <Stack>
        <Field label="Email" hint="Email изменить нельзя: по нему вы входите в приложение.">
          <Input value={data.me.email} disabled readOnly />
        </Field>
        <Field label="Роль в семье">
          <Input value={ROLE_LABELS[data.me.role]} disabled readOnly />
        </Field>
      </Stack>
    </Page>
  )
}
