import { useState } from 'react'
import { updateProfile } from '@/api'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { resizeToAvatar } from '@/lib/image'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { AvatarEditor } from './components/AvatarEditor'
import { NameForm } from './components/NameForm'
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

  async function saveName(name: string) {
    await updateProfile(token, { name })
    // имя хранится и на устройстве (приветствие, шапка), поэтому обновляем и его
    if (identity) await save({ ...identity, name })
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

      <NameForm name={data.me.name} onSave={saveName} />

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
