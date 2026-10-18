import { useMemo, useSyncExternalStore } from 'react'
import type { ChatMessage } from '@/api'

// Своё сообщение, которое ещё уходит на сервер или не ушло. Лежит вне экрана переписки (в памяти приложения): отправка продолжается,
// даже если человек вышел из чата, а неудавшееся сообщение ждёт повторной отправки, когда он вернётся.
export interface PendingMessage {
  // местный номер вида «local-3»; настоящий идентификатор сообщения появится после ответа сервера
  id: string
  chat: string
  text: string
  mediaIds: string[]
  fileIds: string[]
  // что показать в пузыре, пока сообщения нет на сервере: адреса превью фото и имена файлов
  photoUris: string[]
  files: { name: string; size: number }[]
  // ISO-время нажатия «Отправить»
  createdAt: string
  // sending — уходит, failed — не удалось (красная иконка), done — ушло, экран переписки заберёт `sent` в ленту и вызовет `consume`
  status: 'sending' | 'failed' | 'done'
  sent?: ChatMessage
}

export type PendingDraft = Pick<PendingMessage, 'chat' | 'text' | 'mediaIds' | 'fileIds' | 'photoUris' | 'files'>

type Deliver = (draft: PendingDraft) => Promise<ChatMessage>

let items: PendingMessage[] = []
let counter = 0
// как отправлять каждое сообщение (нужно для повтора); не часть состояния, поэтому отдельно
const delivery = new Map<string, Deliver>()
const listeners = new Set<() => void>()
// сколько экранов переписки сейчас смотрят на хранилище: ушедшее сообщение остаётся им «на забор», а без экрана просто убирается
let watchers = 0

const emit = () => listeners.forEach((listener) => listener())
const update = (change: (list: PendingMessage[]) => PendingMessage[]) => {
  items = change(items)
  emit()
}
const patch = (id: string, change: Partial<PendingMessage>) => update((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)))
const drop = (id: string) => {
  delivery.delete(id)
  update((list) => list.filter((p) => p.id !== id))
}

async function run(id: string) {
  const deliver = delivery.get(id)
  const item = items.find((p) => p.id === id)
  if (!deliver || !item) return
  patch(id, { status: 'sending' })
  try {
    const sent = await deliver(item)
    if (watchers > 0) patch(id, { status: 'done', sent })
    else drop(id)
  } catch {
    // сообщение остаётся в ленте с красной иконкой; вложения уже загружены, повтор не требует загрузки заново
    patch(id, { status: 'failed' })
  }
}

// Ставит сообщение в ленту сразу и отправляет его в фоне. Возвращает местный номер.
export function startSend(draft: PendingDraft, deliver: Deliver, now = new Date()): string {
  const id = `local-${++counter}`
  delivery.set(id, deliver)
  update((list) => [...list, { ...draft, id, createdAt: now.toISOString(), status: 'sending' }])
  void run(id)
  return id
}

// Повторная отправка неудавшегося сообщения
export function retrySend(id: string) {
  if (items.find((p) => p.id === id)?.status === 'failed') void run(id)
}

// Убрать неудавшееся сообщение, не отправляя
export const discardPending = drop

// Экран забрал ушедшее сообщение в ленту
export const consumePending = drop

export const getPending = () => items

// Для тестов: сбросить всё
export function resetPending() {
  items = []
  delivery.clear()
  watchers = 0
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  watchers++
  return () => {
    listeners.delete(listener)
    watchers--
    // экран закрыт: ушедшие сообщения забирать некому
    items.filter((p) => p.status === 'done').forEach((p) => delivery.delete(p.id))
    if (watchers === 0 && items.some((p) => p.status === 'done')) update((list) => list.filter((p) => p.status !== 'done'))
  }
}

// Ждущие сообщения этого чата, старые первыми
export function usePending(chat: string): PendingMessage[] {
  const all = useSyncExternalStore(subscribe, getPending, getPending)
  return useMemo(() => all.filter((p) => p.chat === chat), [all, chat])
}

// Похоже на сообщение с сервера, чтобы пузырь рисовал его так же; идентификатор остаётся местным
export function pendingToMessage(p: PendingMessage, senderId: string): ChatMessage {
  return {
    id: p.id,
    senderId,
    text: p.text,
    caption: p.text,
    media: p.photoUris.map((uri, i) => ({ id: `${p.id}-photo-${i}`, width: 1, height: 1, thumbUrl: uri, fullUrl: uri })),
    files: p.files.map((f, i) => ({ id: `${p.id}-file-${i}`, name: f.name, size: f.size, url: '' })),
    createdAt: p.createdAt,
    reactions: [],
    awards: [],
  }
}

export const isPendingId = (id: string) => id.startsWith('local-')
