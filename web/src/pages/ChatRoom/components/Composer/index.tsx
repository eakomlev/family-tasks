import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Notice } from '@/components/Notice'
import { describePhotoError } from '@/lib/errors'
import { resizeToPhoto } from '@/lib/image'
import { canSendMessage, MAX_LENGTH, MAX_PHOTOS } from '../../utils'
import { AttachButton, Bar, Field, Row, SendButton, Strip, Thumb, ThumbRemove, ThumbRetry, ThumbState } from './styles'
import type { Attachment, ComposerProps } from './types'
import { useInFlight } from '@/lib/useInFlight'

let counter = 0
const nextKey = () => `photo-${++counter}`

// Поле ввода сообщения: растёт по мере набора, Enter отправляет, Shift+Enter переносит строку. Скрепка прикладывает фото (до 10):
// выбранные уменьшаются на устройстве и сразу загружаются, а к сообщению прикрепляются кнопкой отправки.
export function Composer({ onSend, onUpload }: ComposerProps) {
  const guard = useInFlight()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [photoNotice, setPhotoNotice] = useState<string>()
  const field = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  // уменьшенные файлы по ключу (для повтора загрузки) и очередь обработки: фото готовятся и грузятся по одному
  const [blobs] = useState(() => new Map<string, Blob>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      blobs.clear()
    }
  }, [blobs])

  // освобождаем локальные адреса превью, когда компонент уходит
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  })
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  // высота по содержимому
  useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight без рамки (border-box): без неё не хватает пикселя и появляется полоса прокрутки
    const border = el.offsetHeight - el.clientHeight
    el.style.height = `${el.scrollHeight + border}px`
    // полоса прокрутки только когда текст не помещается в max-height: дробная высота строки иначе давала лишнюю полосу справа от поля
    el.style.overflowY = el.scrollHeight + border > el.offsetHeight + 1 ? 'auto' : 'hidden'
  }, [text])

  const patch = (key: string, change: Partial<Attachment>) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)))

  async function upload(key: string, blob: Blob) {
    patch(key, { status: 'uploading', error: undefined })
    try {
      const mediaId = await onUpload(blob)
      if (alive.current) patch(key, { status: 'done', mediaId })
    } catch (err) {
      if (alive.current) patch(key, { status: 'failed', error: describePhotoError(err), retryable: true })
    }
  }

  // готовит фото (уменьшает) и загружает; ошибки остаются на самом фото
  async function process(key: string, file: File) {
    let blob: Blob
    try {
      blob = (await resizeToPhoto(file)).blob
    } catch (err) {
      if (alive.current) patch(key, { status: 'failed', error: describePhotoError(err), retryable: false })
      return
    }
    blobs.set(key, blob)
    await upload(key, blob)
  }

  function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'))
    const room = MAX_PHOTOS - photos.length
    const accepted = images.slice(0, Math.max(0, room))
    setPhotoNotice(
      images.length < files.length ? 'Выберите фотографии: другие файлы не поддерживаются.' : images.length > accepted.length ? `К сообщению можно приложить не больше ${MAX_PHOTOS} фото.` : undefined,
    )
    if (accepted.length === 0) return
    const added = accepted.map((file) => ({ key: nextKey(), file }))
    setPhotos((list) => [...list, ...added.map(({ key, file }): Attachment => ({ key, preview: URL.createObjectURL(file), status: 'uploading' }))])
    for (const { key, file } of added) queue.current = queue.current.then(() => process(key, file))
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // тот же файл можно выбрать снова
    e.target.value = ''
    if (files.length > 0) addFiles(files)
  }

  function remove(key: string) {
    const photo = photos.find((p) => p.key === key)
    if (photo) URL.revokeObjectURL(photo.preview)
    blobs.delete(key)
    setPhotos((list) => list.filter((p) => p.key !== key))
    setPhotoNotice(undefined)
  }

  // после отправки: превью и файлы больше не нужны
  function clearPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview))
    blobs.clear()
    setPhotos([])
    setPhotoNotice(undefined)
  }

  function retry(key: string) {
    const blob = blobs.get(key)
    if (blob) queue.current = queue.current.then(() => upload(key, blob))
  }

  const shiftRef = useRef(false)
  const submitRef = useRef<() => Promise<void>>(async () => {})
  const canSend = canSendMessage(text, photos)

  const submit = guard(async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || !canSend) return
    setBusy(true)
    setFailed(false)
    try {
      await onSend({ text: text.trim(), mediaIds: photos.map((p) => p.mediaId!) })
      setText('')
      clearPhotos()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
      field.current?.focus()
    }
  })

  function onKeyDown(e: KeyboardEvent) {
    // при вводе через экранную клавиатуру (composition) Enter подтверждает слово, а не отправляет
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  // мобильные клавиатуры не всегда присылают keydown с Enter: ловим вставку разрыва строки до того, как она случится
  useEffect(() => {
    submitRef.current = submit
  })

  useEffect(() => {
    const el = field.current
    if (!el) return
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'insertLineBreak' && !e.isComposing && !shiftRef.current) {
        e.preventDefault()
        void submitRef.current()
      }
    }
    // Shift+Enter (физическая клавиатура) остаётся переносом строки
    const onKey = (e: globalThis.KeyboardEvent) => {
      shiftRef.current = e.shiftKey
    }
    el.addEventListener('beforeinput', onBeforeInput)
    el.addEventListener('keydown', onKey)
    el.addEventListener('keyup', onKey)
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput)
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('keyup', onKey)
    }
  }, [])

  const uploading = photos.some((p) => p.status === 'uploading')

  return (
    <>
      {failed && <Notice $tone="error">Не удалось отправить сообщение. Попробуйте ещё раз.</Notice>}
      {photoNotice && <Notice $tone="warning">{photoNotice}</Notice>}
      {photos.some((p) => p.status === 'failed') && (
        <Notice $tone="error">{photos.find((p) => p.status === 'failed')?.error} Повторите загрузку или уберите это фото.</Notice>
      )}
      <Bar onSubmit={submit}>
        {photos.length > 0 && (
          <Strip aria-label="Выбранные фото">
            {photos.map((photo, i) => (
              <Thumb key={photo.key} $failed={photo.status === 'failed'}>
                <img src={photo.preview} alt={`Фото ${i + 1}`} />
                {photo.status === 'uploading' && <ThumbState role="status">…</ThumbState>}
                {photo.status === 'failed' &&
                  (photo.retryable ? (
                    <ThumbRetry type="button" aria-label={`Повторить загрузку фото ${i + 1}`} onClick={() => retry(photo.key)}>
                      Ещё раз
                    </ThumbRetry>
                  ) : (
                    <ThumbState $failed>!</ThumbState>
                  ))}
                <ThumbRemove type="button" aria-label={`Убрать фото ${i + 1}`} disabled={busy} onClick={() => remove(photo.key)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </ThumbRemove>
              </Thumb>
            ))}
          </Strip>
        )}
        <Row>
          <input ref={picker} type="file" accept="image/*" multiple hidden aria-label="Выбрать фото" onChange={onPick} />
          <AttachButton type="button" aria-label="Прикрепить фото" disabled={busy || photos.length >= MAX_PHOTOS} onClick={() => picker.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="m20 11-8.2 8.2a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />
            </svg>
          </AttachButton>
          <Field
            ref={field}
            value={text}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={photos.length > 0 ? 'Подпись' : 'Сообщение'}
            aria-label={photos.length > 0 ? 'Подпись к фото' : 'Сообщение'}
            enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value)
              setFailed(false)
            }}
            onKeyDown={onKeyDown}
          />
          <SendButton type="submit" aria-label="Отправить" disabled={busy || !canSend} title={uploading ? 'Фото ещё загружаются' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </SendButton>
        </Row>
      </Bar>
    </>
  )
}
