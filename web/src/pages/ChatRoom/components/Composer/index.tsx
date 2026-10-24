import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Notice } from '@/components/Notice'
import { describeFileError, describePhotoError } from '@/lib/errors'
import { fileProblem, formatFileSize, MAX_FILES } from '@/lib/files'
import { resizeToPhoto } from '@/lib/image'
import { EmojiPanel } from '../EmojiPanel'
import { deleteBefore, insertAt, loadRecent, pushRecent, saveRecent } from '../EmojiPanel/emoji'
import { canSendMessage, MAX_LENGTH, MAX_PHOTOS } from '../../utils'
import { AttachButton, Bar, ContextBar, Field, FileChip, FileInfo, FileList, FileRemove, FileRetry, Row, SendButton, Strip, Thumb, ThumbRemove, ThumbRetry, ThumbState } from './styles'
import type { Attachment, ComposerProps, FileAttachment } from './types'
import { useInFlight } from '@/lib/useInFlight'

let counter = 0
const nextKey = () => `photo-${++counter}`

// Поле ввода сообщения: растёт по мере набора, Enter отправляет, Shift+Enter переносит строку. Скрепка прикладывает фото (до 10):
// выбранные уменьшаются на устройстве и сразу загружаются, а к сообщению прикрепляются кнопкой отправки.
export function Composer({ initialText = '', onSend, onUpload, onUploadFile, reply = null, onCancelReply, editing = null, onCancelEdit, onEditSubmit }: ComposerProps) {
  const guard = useInFlight()
  const [text, setText] = useState(initialText)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [photoNotice, setPhotoNotice] = useState<string>()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const field = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  // уменьшенные файлы по ключу (для повтора загрузки) и очередь обработки: фото готовятся и грузятся по одному
  const [blobs] = useState(() => new Map<string, Blob>())
  // выбранные файлы по ключу (для повтора загрузки)
  const [fileObjects] = useState(() => new Map<string, File>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      blobs.clear()
      fileObjects.clear()
    }
  }, [blobs, fileObjects])

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

  const patchFile = (key: string, change: Partial<FileAttachment>) =>
    setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...change } : f)))

  async function uploadAttachedFile(key: string, file: File) {
    patchFile(key, { status: 'uploading', error: undefined })
    try {
      const fileId = await onUploadFile(file)
      if (alive.current) patchFile(key, { status: 'done', fileId })
    } catch (err) {
      if (alive.current) patchFile(key, { status: 'failed', error: describeFileError(err), retryable: true })
    }
  }

  // Выбранное: картинки идут как фото (уменьшаются), всё остальное как файлы (до MAX_FILES, как есть)
  function addFiles(picked: File[]) {
    const images = picked.filter((f) => f.type.startsWith('image/'))
    const others = picked.filter((f) => !f.type.startsWith('image/'))
    const acceptedImages = images.slice(0, Math.max(0, MAX_PHOTOS - photos.length))
    const acceptedFiles = others.slice(0, Math.max(0, MAX_FILES - files.length))
    setPhotoNotice(
      images.length > acceptedImages.length
        ? `К сообщению можно приложить не больше ${MAX_PHOTOS} фото.`
        : others.length > acceptedFiles.length
          ? `К сообщению можно приложить не больше ${MAX_FILES} файлов.`
          : undefined,
    )
    if (acceptedImages.length > 0) {
      const added = acceptedImages.map((file) => ({ key: nextKey(), file }))
      setPhotos((list) => [...list, ...added.map(({ key, file }): Attachment => ({ key, preview: URL.createObjectURL(file), status: 'uploading' }))])
      for (const { key, file } of added) queue.current = queue.current.then(() => process(key, file))
    }
    if (acceptedFiles.length > 0) {
      const added = acceptedFiles.map((file) => ({ key: nextKey(), file, problem: fileProblem(file) }))
      setFiles((list) => [
        ...list,
        ...added.map(
          ({ key, file, problem }): FileAttachment =>
            problem ? { key, name: file.name, size: file.size, status: 'failed', error: problem, retryable: false } : { key, name: file.name, size: file.size, status: 'uploading' },
        ),
      ])
      for (const { key, file, problem } of added) {
        if (problem) continue
        fileObjects.set(key, file)
        queue.current = queue.current.then(() => uploadAttachedFile(key, file))
      }
    }
  }

  // вставка и стирание эмодзи по курсору; после правки курсор возвращается на место
  function editText(change: (selection: { start: number; end: number }) => { text: string; cursor: number }) {
    const el = field.current
    const next = change({ start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length })
    setText(next.text.slice(0, MAX_LENGTH))
    setFailed(false)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.cursor, next.cursor)
    })
  }

  function pickEmoji(emoji: string) {
    editText((selection) => insertAt(text, selection, emoji))
    const list = pushRecent(recent, emoji)
    setRecent(list)
    saveRecent(list)
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

  function removeFile(key: string) {
    fileObjects.delete(key)
    setFiles((list) => list.filter((f) => f.key !== key))
    setPhotoNotice(undefined)
  }

  function retryFile(key: string) {
    const file = fileObjects.get(key)
    if (file) queue.current = queue.current.then(() => uploadAttachedFile(key, file))
  }

  // после отправки: превью и файлы больше не нужны
  function clearPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview))
    blobs.clear()
    fileObjects.clear()
    setPhotos([])
    setFiles([])
    setPhotoNotice(undefined)
  }

  function retry(key: string) {
    const blob = blobs.get(key)
    if (blob) queue.current = queue.current.then(() => upload(key, blob))
  }

  const shiftRef = useRef(false)
  const submitRef = useRef<() => Promise<void>>(async () => {})
  const canSend = editing ? text.trim().length > 0 : canSendMessage(text, [...photos, ...files])

  // начали править сообщение: его текст ложится в поле, вложения не нужны
  useEffect(() => {
    if (!editing) return
    // oxlint-disable-next-line react/set-state-in-effect -- подставляем текст правимого сообщения
    setText(editing.text)
    clearPhotos()
    field.current?.focus()
    // только при выборе другого сообщения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  function cancelEdit() {
    setText('')
    onCancelEdit?.()
  }

  const submit = guard(async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || !canSend) return
    setBusy(true)
    setFailed(false)
    try {
      if (editing) {
        await onEditSubmit?.(text.trim())
        setText('')
        return
      }
      await onSend({ text: text.trim(), mediaIds: photos.map((p) => p.mediaId!), fileIds: files.map((f) => f.fileId!) })
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

  const uploading = photos.some((p) => p.status === 'uploading') || files.some((f) => f.status === 'uploading')
  const hasAttachments = photos.length > 0 || files.length > 0

  return (
    <>
      {failed && <Notice $tone="error">Не удалось отправить сообщение. Попробуйте ещё раз.</Notice>}
      {photoNotice && <Notice $tone="warning">{photoNotice}</Notice>}
      {photos.some((p) => p.status === 'failed') && (
        <Notice $tone="error">{photos.find((p) => p.status === 'failed')?.error} Повторите загрузку или уберите это фото.</Notice>
      )}
      {files.some((f) => f.status === 'failed') && (
        <Notice $tone="error">{files.find((f) => f.status === 'failed')?.error} Повторите загрузку или уберите этот файл.</Notice>
      )}
      <Bar onSubmit={submit}>
        {(editing || reply) && (
          <ContextBar>
            <div>
              <strong>{editing ? 'Изменение сообщения' : reply!.name}</strong>
              <span>{editing ? editing.text : reply!.text}</span>
            </div>
            <button type="button" aria-label={editing ? 'Отменить изменение' : 'Отменить ответ'} onClick={editing ? cancelEdit : onCancelReply}>
              ×
            </button>
          </ContextBar>
        )}
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
        {files.length > 0 && (
          <FileList aria-label="Выбранные файлы">
            {files.map((file) => (
              <FileChip key={file.key} $failed={file.status === 'failed'}>
                <FileInfo>
                  <strong>{file.name}</strong>
                  <small>{file.status === 'uploading' ? 'Загружается…' : file.status === 'failed' ? 'Не загружен' : formatFileSize(file.size)}</small>
                </FileInfo>
                {file.status === 'failed' && file.retryable && (
                  <FileRetry type="button" aria-label={`Повторить загрузку файла ${file.name}`} onClick={() => retryFile(file.key)}>
                    Ещё раз
                  </FileRetry>
                )}
                <FileRemove type="button" aria-label={`Убрать файл ${file.name}`} disabled={busy} onClick={() => removeFile(file.key)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </FileRemove>
              </FileChip>
            ))}
          </FileList>
        )}
        <Row>
          <input ref={picker} type="file" multiple hidden aria-label="Выбрать фото или файл" onChange={onPick} />
          <AttachButton type="button" style={editing ? { display: 'none' } : undefined} aria-label="Прикрепить фото или файл" disabled={busy || (photos.length >= MAX_PHOTOS && files.length >= MAX_FILES)} onClick={() => picker.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="m20 11-8.2 8.2a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />
            </svg>
          </AttachButton>
          <Field
            ref={field}
            value={text}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={hasAttachments ? 'Подпись' : 'Сообщение'}
            aria-label={photos.length > 0 ? 'Подпись к фото' : files.length > 0 ? 'Подпись к файлам' : 'Сообщение'}
            enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value)
              setFailed(false)
            }}
            onKeyDown={onKeyDown}
          />
          <AttachButton type="button" aria-label="Эмодзи" aria-pressed={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M8.5 14c.8 1.4 2 2.1 3.5 2.1s2.7-.7 3.5-2.1M9 9.8h.01M15 9.8h.01" />
            </svg>
          </AttachButton>
          <SendButton type="submit" aria-label="Отправить" disabled={busy || !canSend} title={uploading ? 'Вложения ещё загружаются' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </SendButton>
        </Row>
        {emojiOpen && <EmojiPanel recent={recent} onPick={pickEmoji} onBackspace={() => editText((selection) => deleteBefore(text, selection))} />}
      </Bar>
    </>
  )
}
