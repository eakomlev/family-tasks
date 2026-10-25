import type { Pool, PoolClient } from 'pg'
import { expiryFor, sign } from './sign.js'

type Db = Pick<Pool | PoolClient, 'query'>

// Фото сообщения в ответах API: размеры известны заранее (лента не прыгает), адреса подписаны.
export interface MediaDto {
  id: string
  width: number
  height: number
  thumbUrl: string
  fullUrl: string
}

// Не больше фото в одном сообщении и размер файла после сжатия на клиенте.
export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
// Сколько места занимает семья (полноразмерные варианты), по умолчанию 2 ГБ.
export const mediaQuotaBytes = () => {
  const n = Number(process.env.MEDIA_QUOTA_BYTES)
  return Number.isFinite(n) && n > 0 ? n : 2 * 1024 * 1024 * 1024
}

export function mediaUrls(secret: string, family: string, id: string, now: Date): { thumbUrl: string; fullUrl: string } {
  const exp = expiryFor(now)
  const query = `?exp=${exp}&sig=${sign(secret, family, id, exp)}`
  return { thumbUrl: `/media/${family}/${id}/thumb${query}`, fullUrl: `/media/${family}/${id}/full${query}` }
}

// Заглушка в text для сообщения только с фото (видит старая версия клиента): «📷 Фото» или «📷 Фото ×3».
export const photoPlaceholder = (count: number) => (count === 1 ? '📷 Фото' : `📷 Фото ×${count}`)

// Фото сообщений одним запросом: сообщение -> фото по порядку. secret null (фото не настроены): адреса не строятся, фото нет.
export async function loadMedia(
  db: Db,
  secret: string | null,
  messageIds: string[],
  now = new Date(),
): Promise<Map<string, MediaDto[]>> {
  const out = new Map<string, MediaDto[]>()
  if (messageIds.length === 0 || !secret) return out
  const { rows } = await db.query<{ messageId: string; id: string; familyId: string; width: number; height: number }>(
    `select mm.message_id as "messageId", m.id, m.family_id as "familyId", m.width, m.height
     from message_media mm join media m on m.id = mm.media_id
     where mm.message_id = any($1) and m.kind = 'image' order by mm.message_id, mm.position`,
    [messageIds],
  )
  for (const r of rows) {
    const list = out.get(r.messageId) ?? []
    list.push({ id: r.id, width: r.width, height: r.height, ...mediaUrls(secret, r.familyId, r.id, now) })
    out.set(r.messageId, list)
  }
  return out
}

// ---- видео в чатах ----

// Видео сообщения в ответах API: размеры кадра и длительность известны заранее (лента не прыгает), url играет видео по частям.
export interface VideoDto {
  id: string
  width: number
  height: number
  // секунды
  duration: number
  thumbUrl: string
  url: string
}

// Не больше видео в одном сообщении и размер загрузки (по умолчанию 100 МБ, до сжатия).
export const MAX_VIDEOS = 3
export const maxVideoBytes = () => {
  const n = Number(process.env.MAX_VIDEO_BYTES)
  return Number.isFinite(n) && n > 0 ? n : 100 * 1024 * 1024
}

export function videoUrls(secret: string, family: string, id: string, now: Date): { thumbUrl: string; url: string } {
  const exp = expiryFor(now)
  const query = `?exp=${exp}&sig=${sign(secret, family, id, exp)}`
  return { thumbUrl: `/media/${family}/${id}/thumb${query}`, url: `/media/${family}/${id}/video${query}` }
}

// Видео сообщений одним запросом: сообщение -> видео по порядку.
export async function loadVideos(db: Db, secret: string | null, messageIds: string[], now = new Date()): Promise<Map<string, VideoDto[]>> {
  const out = new Map<string, VideoDto[]>()
  if (messageIds.length === 0 || !secret) return out
  const { rows } = await db.query<{ messageId: string; id: string; familyId: string; width: number; height: number; duration: number }>(
    `select mm.message_id as "messageId", m.id, m.family_id as "familyId", m.width, m.height, m.duration
     from message_media mm join media m on m.id = mm.media_id
     where mm.message_id = any($1) and m.kind = 'video' order by mm.message_id, mm.position`,
    [messageIds],
  )
  for (const r of rows) {
    const list = out.get(r.messageId) ?? []
    list.push({ id: r.id, width: r.width, height: r.height, duration: r.duration, ...videoUrls(secret, r.familyId, r.id, now) })
    out.set(r.messageId, list)
  }
  return out
}

// ---- обычные файлы в чатах (документы, архивы и т. п.) ----

// Файл сообщения в ответах API. url ведёт на скачивание: сервис media всегда отдаёт его как бинарный attachment.
export interface FileDto {
  id: string
  name: string
  size: number
  url: string
}

// Не больше файлов в одном сообщении и размер одного файла (по умолчанию 10 МБ).
export const MAX_FILES = 5
export const maxFileBytes = () => {
  const n = Number(process.env.MAX_FILE_BYTES)
  return Number.isFinite(n) && n > 0 ? n : 10 * 1024 * 1024
}
export const MAX_FILE_NAME = 120

// Расширения, которые не пересылаем: исполняемое, сценарии и страницы (открытая у получателя страница может выдавать себя за что угодно).
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'msc', 'dll', 'sys', 'lnk', 'reg', 'hta', 'jar', 'apk', 'ipa', 'app', 'dmg',
  'pkg', 'deb', 'rpm', 'iso', 'vbs', 'vbe', 'js', 'jse', 'mjs', 'wsf', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'command',
  'html', 'htm', 'xhtml', 'mht', 'mhtml', 'svg',
])

// Безопасное имя файла: без пути и управляющих знаков, не длиннее MAX_FILE_NAME (расширение сохраняется). Пустое имя: null.
export function cleanFileName(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const base = raw.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()!.replace(/^\.+/, '').trim()
  if (!base) return null
  if (base.length <= MAX_FILE_NAME) return base
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 && base.length - dot <= 12 ? base.slice(dot) : ''
  return base.slice(0, MAX_FILE_NAME - ext.length) + ext
}

export function isBlockedFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  // проверяем и последнее расширение, и «двойное» (отчёт.pdf.exe) через последнее: оно решает, чем файл откроется
  return dot >= 0 && BLOCKED_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

// Заглушка в text для сообщения только с вложениями (видит старая версия клиента).
export function attachmentPlaceholder(photos: number, files: Pick<FileDto, 'name'>[], videos = 0): string {
  if (files.length === 0 && videos === 0) return photoPlaceholder(photos)
  if (photos === 0 && videos === 0) return files.length === 1 ? `📎 ${files[0].name}` : `📎 Файлы ×${files.length}`
  if (photos === 0 && files.length === 0) return videos === 1 ? '🎬 Видео' : `🎬 Видео ×${videos}`
  return `📎 Вложения ×${photos + files.length + videos}`
}

export function fileUrl(secret: string, family: string, id: string, name: string, now: Date): string {
  const exp = expiryFor(now)
  return `/media/${family}/${id}/file?exp=${exp}&sig=${sign(secret, family, id, exp)}&name=${encodeURIComponent(name)}`
}

// Файлы сообщений одним запросом: сообщение -> файлы по порядку.
export async function loadFiles(db: Db, secret: string | null, messageIds: string[], now = new Date()): Promise<Map<string, FileDto[]>> {
  const out = new Map<string, FileDto[]>()
  if (messageIds.length === 0 || !secret) return out
  const { rows } = await db.query<{ messageId: string; id: string; familyId: string; name: string; size: number }>(
    `select mm.message_id as "messageId", m.id, m.family_id as "familyId", m.file_name as name, m.size
     from message_media mm join media m on m.id = mm.media_id
     where mm.message_id = any($1) and m.kind = 'file' order by mm.message_id, mm.position`,
    [messageIds],
  )
  for (const r of rows) {
    const list = out.get(r.messageId) ?? []
    list.push({ id: r.id, name: r.name, size: r.size, url: fileUrl(secret, r.familyId, r.id, r.name, now) })
    out.set(r.messageId, list)
  }
  return out
}
