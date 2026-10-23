import { useEffect, useRef, useState } from 'react'
import { Image, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled, { useTheme } from 'styled-components/native'
import { ActionSheet } from '@/components/ActionSheet'
import { Notice } from '@/components/Notice'
import { Text } from '@/components/Text'
import { withType } from '@/lib/blob'
import { describeFileError, describePhotoError } from '@/lib/errors'
import { fileProblem, formatFileSize, MAX_FILES } from '@/lib/files'
import type { SharedContent } from '@/lib/incomingShare'
import { preparePhoto } from '@/lib/photos'
import { useInFlight } from '@/lib/useInFlight'
import { FONT_FAMILY } from '@/theme/fonts'
import { deleteBefore, insertAt, loadRecent, pushRecent, saveRecent } from './emoji'
import { EmojiPanel } from './EmojiPanel'
import { canSendMessage, MAX_LENGTH, MAX_PHOTOS } from './roomUtils'

export interface OutgoingMessage {
  // подпись или текст (после обрезки), может быть пустым, если есть фото или файлы
  text: string
  // загруженные фото в порядке показа
  mediaIds: string[]
  // загруженные файлы в порядке показа
  fileIds: string[]
  // что показать в ленте, пока сообщение уходит: адреса превью фото и имена файлов
  photoUris: string[]
  files: { name: string; size: number }[]
}

interface ComposerProps {
  // отправляет сообщение; не ждёт ответа сервера: поле очищается сразу, а сообщение уже стоит в ленте (с ошибкой, если не ушло)
  onSend: (message: OutgoingMessage) => void
  // загружает одно уже уменьшенное фото и возвращает его идентификатор; бросает ошибку, если не вышло
  onUpload: (photo: Blob) => Promise<string>
  // загружает один файл и возвращает его идентификатор; бросает ошибку, если не вышло
  onUploadFile: (file: { blob: Blob; name: string }) => Promise<string>
  // под полем стоит своя панель (чат внутри страницы события): отступ безопасной зоны не нужен
  flushBottom?: boolean
  // поделились из другого приложения: текст, фото и файлы ложатся в поле при открытии чата (читается один раз)
  incoming?: SharedContent | null
  // отвечаем на сообщение: над полем показана цитата, отправка уйдёт ответом
  reply?: { name: string; text: string } | null
  onCancelReply?: () => void
  // правим своё сообщение: текст ложится в поле, вложений нет, отправка сохраняет правку (бросает ошибку, если не вышло)
  editing?: { id: string; text: string } | null
  onCancelEdit?: () => void
  onEditSubmit?: (text: string) => Promise<void>
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

// Поле растёт по высоте вместе с текстом, как в Telegram: до пяти строк, дальше внутри него появляется прокрутка
const LINE_HEIGHT = 22
const MAX_LINES = 5
const FIELD_PADDING = 10

// без flex: 1: в колонке он схлопывал бы поле до min-height и оно переставало расти
const Field = styled(TextInput)`
  line-height: ${({ theme }) => Math.round(LINE_HEIGHT * theme.fontScale)}px;
  max-height: ${({ theme }) => Math.round(LINE_HEIGHT * theme.fontScale) * MAX_LINES + FIELD_PADDING * 2}px;
  min-height: 44px;
  padding: ${FIELD_PADDING}px 16px;
  text-align-vertical: top;
  border-radius: 22px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${FONT_FAMILY.regular};
  font-size: ${({ theme }) => 16 * theme.fontScale}px;
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
export function Composer({ onSend, onUpload, onUploadFile, flushBottom = false, incoming = null, reply = null, onCancelReply, editing = null, onCancelEdit, onEditSubmit }: ComposerProps) {
  const guard = useInFlight()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [text, setText] = useState('')
  const [items, setItems] = useState<Attachment[]>([])
  const [menu, setMenu] = useState(false)
  // пока клавиатура открыта, нижний отступ безопасной зоны не нужен: поле стоит прямо над ней
  const [keyboard, setKeyboard] = useState(false)
  const [notice, setNotice] = useState<string>()
  // панель эмодзи вместо клавиатуры, недавние и положение курсора (по нему вставляем и стираем)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  // выставляем курсор сами только сразу после вставки, дальше он свободен
  const [forced, setForced] = useState<{ start: number; end: number }>()
  const input = useRef<{ focus: () => void } | null>(null)
  // подготовленные фото и выбранные файлы по ключу (повтор загрузки без повторного выбора)
  const [blobs] = useState(() => new Map<string, Blob>())
  // фото готовятся и грузятся по одному
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

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

  function addPhotos(assets: { uri: string; width: number; height: number }[]) {
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

  // файлы к сообщению: выбранные в проводнике или полученные из другого приложения
  async function addFiles(assets: { uri: string; name: string; size: number }[]) {
    const room = MAX_FILES - files.length
    setNotice(assets.length > room ? `К сообщению можно приложить до ${MAX_FILES} файлов.` : undefined)
    for (const asset of assets.slice(0, Math.max(room, 0))) {
      const key = nextKey()
      const size = asset.size
      const problem = fileProblem({ name: asset.name, size })
      if (problem) {
        setItems((current) => [...current, { key, kind: 'file', name: asset.name, size, status: 'failed', error: problem, retryable: false }])
        continue
      }
      const item: Attachment = { key, kind: 'file', name: asset.name, size, status: 'uploading', retryable: true }
      setItems((current) => [...current, item])
      try {
        blobs.set(key, withType(await (await fetch(asset.uri)).blob(), 'application/octet-stream'))
        void upload(item)
      } catch {
        patch(key, { status: 'failed', error: 'Не удалось прочитать файл.', retryable: false })
      }
    }
  }

  const pickFiles = guard(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (picked.canceled) return
    await addFiles(picked.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size ?? 0 })))
  })

  // Полученное из другого приложения (экран «Поделиться»): текст в поле, картинки как фото (размер узнаём сами: у такого содержимого его нет),
  // остальное файлами. Применяется один раз при открытии чата.
  const incomingApplied = useRef(false)
  useEffect(() => {
    if (!incoming || incomingApplied.current) return
    incomingApplied.current = true
    if (incoming.text) setText(incoming.text.slice(0, MAX_LENGTH))
    void (async () => {
      const sized: { uri: string; width: number; height: number }[] = []
      for (const image of incoming.images) {
        const size = await new Promise<{ width: number; height: number }>((resolve) => {
          Image.getSize(image.uri, (width, height) => resolve({ width, height }), () => resolve({ width: 1600, height: 1600 }))
        })
        sized.push({ uri: image.uri, ...size })
      }
      if (sized.length > 0) addPhotos(sized)
      if (incoming.files.length > 0) await addFiles(incoming.files)
    })()
    // один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = (key: string) => {
    blobs.delete(key)
    setItems((current) => current.filter((i) => i.key !== key))
  }

  const ready = editing ? text.trim().length > 0 : canSendMessage(text, items)

  // начали править сообщение: его текст ложится в поле, вложения не нужны
  useEffect(() => {
    if (!editing) return
    setText(editing.text)
    setItems([])
    blobs.clear()
    setNotice(undefined)
    input.current?.focus()
    // только при выборе другого сообщения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  function cancelEdit() {
    setText('')
    onCancelEdit?.()
  }

  function applyEdit(next: { text: string; cursor: number }) {
    if (next.text.length > MAX_LENGTH) return
    setText(next.text)
    setForced({ start: next.cursor, end: next.cursor })
    setSelection({ start: next.cursor, end: next.cursor })
  }

  function pickEmoji(emoji: string) {
    applyEdit(insertAt(text, selection, emoji))
    const next = pushRecent(recent, emoji)
    setRecent(next)
    saveRecent(next)
  }

  function toggleEmoji() {
    if (emojiOpen) {
      setEmojiOpen(false)
      input.current?.focus()
    } else {
      Keyboard.dismiss()
      setEmojiOpen(true)
    }
  }

  const send = guard(async () => {
    if (!ready) return
    if (editing) {
      try {
        await onEditSubmit?.(text.trim())
        setText('')
        setNotice(undefined)
      } catch {
        setNotice('Не удалось сохранить изменения. Попробуйте ещё раз.')
      }
      return
    }
    onSend({
      text: text.trim(),
      mediaIds: photos.map((p) => p.id!).filter(Boolean),
      fileIds: files.map((f) => f.id!).filter(Boolean),
      photoUris: photos.map((p) => p.uri ?? ''),
      files: files.map((f) => ({ name: f.name ?? 'Файл', size: f.size ?? 0 })),
    })
    // сообщение уже в ленте: поле и вложения освобождаются сразу
    setText('')
    setItems([])
    blobs.clear()
    setNotice(undefined)
  })

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: keyboard || emojiOpen || flushBottom ? 0 : insets.bottom }}>
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
      {(editing || reply) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
          <Ionicons name={editing ? 'create-outline' : 'arrow-undo-outline'} size={20} color={colors.accent} />
          <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 8 }}>
            <Text $size={12} $weight="extraBold" $tone="accent" numberOfLines={1}>
              {editing ? 'Изменение сообщения' : reply!.name}
            </Text>
            <Text $size={13} $tone="muted" numberOfLines={1}>
              {editing ? editing.text : reply!.text}
            </Text>
          </View>
          <Pressable onPress={editing ? cancelEdit : onCancelReply} accessibilityRole="button" accessibilityLabel={editing ? 'Отменить изменение' : 'Отменить ответ'} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>
      )}
      {notice && (
        <View style={{ paddingHorizontal: 12 }}>
          <Notice tone="warning">{notice}</Notice>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10 }}>
        {!editing && (
          <RoundButton onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Прикрепить">
            <Ionicons name="attach" size={24} color={colors.text} />
          </RoundButton>
        )}
        <View style={{ flex: 1 }}>
        <Field
          ref={input as never}
          value={text}
          selection={forced}
          onSelectionChange={(e) => {
            setSelection(e.nativeEvent.selection)
            setForced(undefined)
          }}
          onFocus={() => setEmojiOpen(false)}
          onChangeText={setText}
          placeholder={photos.length > 0 && text === '' ? 'Подпись' : 'Сообщение'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_LENGTH}
          accessibilityLabel="Сообщение"
          style={{ paddingRight: 48 }}
        />
        <Pressable onPress={toggleEmoji} accessibilityRole="button" accessibilityLabel={emojiOpen ? 'Клавиатура' : 'Эмодзи'} hitSlop={6} style={{ position: 'absolute', right: 10, bottom: 9, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={26} color={colors.muted} />
        </Pressable>
        </View>
        <RoundButton $on={ready} disabled={!ready} onPress={send} accessibilityRole="button" accessibilityLabel="Отправить">
          <Ionicons name="arrow-up" size={22} color={ready ? '#ffffff' : colors.muted} />
        </RoundButton>
      </View>
      {emojiOpen && (
        <EmojiPanel recent={recent} onPick={pickEmoji} onBackspace={() => applyEdit(deleteBefore(text, selection))} />
      )}
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
