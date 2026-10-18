import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled, { useTheme } from 'styled-components/native'
import { ActionSheet } from '@/components/ActionSheet'
import { Notice } from '@/components/Notice'
import { Text } from '@/components/Text'
import { describeFileError, describePhotoError } from '@/lib/errors'
import { fileProblem, formatFileSize, MAX_FILES } from '@/lib/files'
import { preparePhoto } from '@/lib/photos'
import { useInFlight } from '@/lib/useInFlight'
import { FONT_FAMILY } from '@/theme/fonts'
import { canSendMessage, MAX_LENGTH, MAX_PHOTOS } from './roomUtils'

export interface OutgoingMessage {
  // подпись или текст (после обрезки), может быть пустым, если есть фото или файлы
  text: string
  // загруженные фото в порядке показа
  mediaIds: string[]
  // загруженные файлы в порядке показа
  fileIds: string[]
}

interface ComposerProps {
  // отправляет сообщение; должен бросить ошибку, если не вышло (текст и вложения тогда остаются в поле)
  onSend: (message: OutgoingMessage) => Promise<void>
  // загружает одно уже уменьшенное фото и возвращает его идентификатор; бросает ошибку, если не вышло
  onUpload: (photo: Blob) => Promise<string>
  // загружает один файл и возвращает его идентификатор; бросает ошибку, если не вышло
  onUploadFile: (file: { blob: Blob; name: string }) => Promise<string>
}

// Вложение (фото или файл) на пути от выбора до отправки
interface Attachment {
  key: string
  kind: 'photo' | 'file'
  // фото: адрес превью; файл: имя и размер
  uri?: string
  name?: string
  size?: number
  status: 'uploading' | 'done' | 'failed'
  id?: string
  error?: string
  // можно повторить загрузку (нет, если файл отклонён ещё на устройстве)
  retryable?: boolean
}

const Field = styled(TextInput)`
  flex: 1;
  max-height: 140px;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 22px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${FONT_FAMILY.regular};
  font-size: 16px;
`

const RoundButton = styled(Pressable)<{ $on?: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $on }) => ($on ? theme.colors.accent : theme.colors.track)};
`

// системное окно выбора открываем, когда меню уже закрылось: иначе на iPhone два окна подряд мешают друг другу
const later = (action: () => void | Promise<void>) => void setTimeout(() => void action(), 350)

let counter = 0
const nextKey = () => `att-${++counter}`

// Поле ввода сообщения. Скрепка прикладывает фото (до 10; галерея или камера) и файлы (до 5): фото уменьшаются на устройстве,
// всё сразу загружается, а к сообщению прикрепляется кнопкой отправки. Ошибка загрузки показана на самом вложении.
export function Composer({ onSend, onUpload, onUploadFile }: ComposerProps) {
  const guard = useInFlight()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [items, setItems] = useState<Attachment[]>([])
  const [menu, setMenu] = useState(false)
  const [notice, setNotice] = useState<string>()
  // подготовленные фото и выбранные файлы по ключу (повтор загрузки без повторного выбора)
  const [blobs] = useState(() => new Map<string, Blob>())
  // фото готовятся и грузятся по одному
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      blobs.clear()
    }
  }, [blobs])

  const patch = (key: string, change: Partial<Attachment>) => setItems((current) => current.map((i) => (i.key === key ? { ...i, ...change } : i)))

  const photos = items.filter((i) => i.kind === 'photo')
  const files = items.filter((i) => i.kind === 'file')

  async function upload(item: Attachment) {
    const blob = blobs.get(item.key)
    if (!blob) return patch(item.key, { status: 'failed', retryable: false })
    patch(item.key, { status: 'uploading', error: undefined })
    try {
      const id = item.kind === 'photo' ? await onUpload(blob) : await onUploadFile({ blob, name: item.name! })
      if (alive.current) patch(item.key, { status: 'done', id })
    } catch (err) {
      if (alive.current) patch(item.key, { status: 'failed', error: item.kind === 'photo' ? describePhotoError(err) : describeFileError(err), retryable: true })
    }
  }

  function addPhotos(assets: ImagePicker.ImagePickerAsset[]) {
    const room = MAX_PHOTOS - photos.length
    if (assets.length > room) setNotice(`К сообщению можно приложить до ${MAX_PHOTOS} фото.`)
    else setNotice(undefined)
    for (const asset of assets.slice(0, Math.max(room, 0))) {
      const key = nextKey()
      const item: Attachment = { key, kind: 'photo', uri: asset.uri, status: 'uploading', retryable: false }
      setItems((current) => [...current, item])
      // готовим и грузим по очереди: десять тяжёлых фото разом перегрузят телефон
      queue.current = queue.current.then(async () => {
        if (!alive.current) return
        try {
          const prepared = await preparePhoto(asset.uri, asset.width, asset.height)
          blobs.set(key, prepared.blob)
          patch(key, { uri: prepared.uri, retryable: true })
          await upload({ ...item, uri: prepared.uri })
        } catch (err) {
          if (alive.current) patch(key, { status: 'failed', error: describePhotoError(err), retryable: false })
        }
      })
    }
  }

  const pickFromGallery = guard(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setNotice('Нет доступа к фотографиям. Разрешите его в настройках телефона.')
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 1 })
    if (!picked.canceled) addPhotos(picked.assets)
  })

  const takePhoto = guard(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) return setNotice('Нет доступа к камере. Разрешите его в настройках телефона.')
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
    if (!shot.canceled) addPhotos(shot.assets)
  })

  const pickFiles = guard(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (picked.canceled) return
    const room = MAX_FILES - files.length
    setNotice(picked.assets.length > room ? `К сообщению можно приложить до ${MAX_FILES} файлов.` : undefined)
    for (const asset of picked.assets.slice(0, Math.max(room, 0))) {
      const key = nextKey()
      const size = asset.size ?? 0
      const problem = fileProblem({ name: asset.name, size })
      if (problem) {
        setItems((current) => [...current, { key, kind: 'file', name: asset.name, size, status: 'failed', error: problem, retryable: false }])
        continue
      }
      const item: Attachment = { key, kind: 'file', name: asset.name, size, status: 'uploading', retryable: true }
      setItems((current) => [...current, item])
      try {
        blobs.set(key, await (await fetch(asset.uri)).blob())
        void upload(item)
      } catch {
        patch(key, { status: 'failed', error: 'Не удалось прочитать файл.', retryable: false })
      }
    }
  })

  const remove = (key: string) => {
    blobs.delete(key)
    setItems((current) => current.filter((i) => i.key !== key))
  }

  const ready = canSendMessage(text, items) && !busy

  const send = guard(async () => {
    if (!ready) return
    setBusy(true)
    setFailed(false)
    try {
      await onSend({
        text: text.trim(),
        mediaIds: photos.map((p) => p.id!).filter(Boolean),
        fileIds: files.map((f) => f.id!).filter(Boolean),
      })
      setText('')
      setItems([])
      blobs.clear()
      setNotice(undefined)
    } catch {
      // текст и вложения остаются: повторить можно сразу, загружать заново не нужно
      setFailed(true)
    } finally {
      setBusy(false)
    }
  })

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom }}>
      {(photos.length > 0 || files.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 10 }} keyboardShouldPersistTaps="handled">
          {photos.map((p) => (
            <View key={p.key} style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.track }}>
              {p.uri && <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, opacity: p.status === 'done' ? 1 : 0.5 }} />}
              {p.status === 'uploading' && (
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text $size={11} $weight="bold">…</Text>
                </View>
              )}
              {p.status === 'failed' && (
                <Pressable
                  disabled={!p.retryable}
                  onPress={() => void upload(p)}
                  accessibilityLabel={p.error}
                  style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  <Text $size={11} $weight="extraBold" style={{ color: '#ffffff' }}>{p.retryable ? 'Ещё раз' : 'Ошибка'}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => remove(p.key)} accessibilityLabel="Убрать фото" hitSlop={6} style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={14} color="#ffffff" />
              </Pressable>
            </View>
          ))}
          {files.map((f) => (
            <View key={f.key} style={{ minWidth: 140, maxWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: f.status === 'failed' ? colors.error : colors.border }}>
              <Ionicons name="document-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text $size={13} $weight="bold" numberOfLines={1}>{f.name}</Text>
                <Text $size={11} $tone={f.status === 'failed' ? 'error' : 'muted'} numberOfLines={2}>
                  {f.status === 'failed' ? f.error : f.status === 'uploading' ? 'Загружается…' : formatFileSize(f.size ?? 0)}
                </Text>
              </View>
              {f.status === 'failed' && f.retryable && (
                <Pressable onPress={() => void upload(f)} accessibilityLabel="Повторить загрузку" hitSlop={6}>
                  <Ionicons name="refresh" size={18} color={colors.accent} />
                </Pressable>
              )}
              <Pressable onPress={() => remove(f.key)} accessibilityLabel="Убрать файл" hitSlop={6}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      {notice && (
        <View style={{ paddingHorizontal: 12 }}>
          <Notice tone="warning">{notice}</Notice>
        </View>
      )}
      {failed && (
        <View style={{ paddingHorizontal: 12 }}>
          <Notice tone="error">Не удалось отправить. Попробуйте ещё раз.</Notice>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10 }}>
        <RoundButton onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Прикрепить">
          <Ionicons name="attach" size={24} color={colors.text} />
        </RoundButton>
        <Field
          value={text}
          onChangeText={(value) => {
            setText(value)
            setFailed(false)
          }}
          placeholder={photos.length > 0 && text === '' ? 'Подпись' : 'Сообщение'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_LENGTH}
          accessibilityLabel="Сообщение"
        />
        <RoundButton $on={ready} disabled={!ready} onPress={send} accessibilityRole="button" accessibilityLabel="Отправить">
          <Ionicons name="arrow-up" size={22} color={ready ? '#ffffff' : colors.muted} />
        </RoundButton>
      </View>
      {menu && (
        <ActionSheet
          title="Прикрепить"
          onClose={() => setMenu(false)}
          actions={[
            { key: 'gallery', label: 'Фото из галереи', onSelect: () => later(pickFromGallery) },
            { key: 'camera', label: 'Снять фото', onSelect: () => later(takePhoto) },
            { key: 'file', label: 'Файл', onSelect: () => later(pickFiles) },
          ]}
        />
      )}
    </View>
  )
}
