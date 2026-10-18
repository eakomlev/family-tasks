import { useState } from 'react'
import { View } from 'react-native'
import { getRobloxAvatar, type ProfilePatch } from '@/api'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { DateTimeField } from '@/components/DateTimeField'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, PageTitle } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge } from '@/lib/date'
import { pickSquareImage } from '@/lib/image'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useUpdateProfileMutation } from '@/store/profile'
import { describePhotoError, describeSaveError } from './errors'

const AVATAR_SIZE = 128

// Изменить профиль: фото (из галереи или аватар из Roblox у детей), имя и дата рождения
export function ProfileEditScreen() {
  const guard = useInFlight()
  const { identity, save } = useIdentity()
  const { data } = useProfile()
  const [updateProfile] = useUpdateProfileMutation()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string>()
  const [roblox, setRoblox] = useState('')

  const me = data?.me
  const [nameValue, setNameValue] = useState<string>()
  const [birthValue, setBirthValue] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  if (!identity) return null
  const token = identity.token

  const changePhoto = guard(async (remove: boolean) => {
    setPhotoBusy(true)
    setPhotoError(undefined)
    try {
      const avatar = remove ? null : await pickSquareImage(AVATAR_SIZE)
      // отмена выбора ничего не меняет
      if (!remove && avatar === null) return
      await updateProfile({ avatar }).unwrap().catch(toApiError)
    } catch (err) {
      setPhotoError(describePhotoError(err))
    } finally {
      setPhotoBusy(false)
    }
  })

  // аватар из Roblox: сервер отдаёт картинку (data URL), её сохраняем как есть: размер у неё уже небольшой
  const takeRoblox = guard(async () => {
    if (!roblox.trim()) return
    setPhotoBusy(true)
    setPhotoError(undefined)
    try {
      const { image } = await getRobloxAvatar(token, roblox.trim())
      await updateProfile({ avatar: image }).unwrap().catch(toApiError)
      setRoblox('')
    } catch (err) {
      setPhotoError(describePhotoError(err))
    } finally {
      setPhotoBusy(false)
    }
  })

  if (!me) {
    return (
      <Screen bottomReserve={88}>
        <BackLink fallback="/profile">← Профиль</BackLink>
        <PageTitle>Изменить профиль</PageTitle>
        <Text $tone="muted">Загрузка…</Text>
      </Screen>
    )
  }

  const name = nameValue ?? me.name
  const birth = birthValue ?? me.birthDate ?? ''
  const trimmed = name.trim()
  const nameChanged = trimmed !== me.name
  const birthChanged = birth !== (me.birthDate ?? '')
  const ready = (nameChanged || birthChanged) && trimmed.length > 0 && !busy

  const edit = (update: () => void) => {
    update()
    setSaved(false)
    setError(undefined)
  }

  const submit = guard(async () => {
    if (!ready) return
    const patch: ProfilePatch = {}
    if (nameChanged) patch.name = trimmed
    if (birthChanged) patch.birthDate = birth || null
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      await updateProfile(patch).unwrap().catch(toApiError)
      // имя хранится и на устройстве (приветствие), поэтому обновляем и его
      if (patch.name) await save({ ...identity, name: patch.name })
      setNameValue(undefined)
      setBirthValue(undefined)
      setSaved(true)
    } catch (err) {
      setError(describeSaveError(err))
    } finally {
      setBusy(false)
    }
  })

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback="/profile">← Профиль</BackLink>
      <PageTitle>Изменить профиль</PageTitle>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={me.name} seed={me.id} src={me.avatar} size={112} />
        <Button variant="text" disabled={photoBusy} onPress={() => void changePhoto(false)}>
          {me.avatar ? 'Изменить фото' : 'Добавить фото'}
        </Button>
        {me.avatar && (
          <Button variant="text" disabled={photoBusy} onPress={() => void changePhoto(true)}>
            Убрать фото
          </Button>
        )}
      </View>
      {me.role === 'child' && (
        <Stack $gap={8}>
          <Field label="Аватар из Roblox" hint="Введите ник в Roblox, возьмём аватар оттуда.">
            <Input value={roblox} onChangeText={setRoblox} autoCapitalize="none" autoCorrect={false} placeholder="Ник в Roblox" />
          </Field>
          <Button disabled={photoBusy || !roblox.trim()} onPress={() => void takeRoblox()}>
            Взять аватар из Roblox
          </Button>
        </Stack>
      )}
      {photoError && <Notice tone="error">{photoError}</Notice>}

      <Stack>
        <Field label="Имя">
          <Input value={name} onChangeText={(value) => edit(() => setNameValue(value))} maxLength={40} autoComplete="given-name" />
        </Field>
        <Field label="Дата рождения" hint={birth ? formatAge(ageFromBirthDate(birth)) : undefined}>
          <DateTimeField mode="date" value={birth} onChange={(value) => edit(() => setBirthValue(value))} accessibilityLabel="Дата рождения" />
        </Field>
        {birth !== '' && (
          <Button variant="text" onPress={() => edit(() => setBirthValue(''))}>
            Убрать дату рождения
          </Button>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice>Сохранено.</Notice>}
        <Button variant="primary" disabled={!ready} onPress={submit}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </Stack>
    </Screen>
  )
}
