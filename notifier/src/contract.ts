// Контракт с server: таблица outbox и формат payload. Типы продублированы в server/src/outbox/contract.ts
// (общего пакета нет), совместимость держит поле v и тест на одних и тех же примерах payload.

export const SUPPORTED_VERSION = 1

export interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

export interface EmailPayload {
  v: 1
  kind: 'code'
  to: string
  code: string
  ttlMinutes: number
}

export interface PushPayload {
  v: 1
  subscriptionId: string
  message: PushMessage
}

export type Parsed =
  | { ok: true; channel: 'email'; payload: EmailPayload }
  | { ok: true; channel: 'push'; payload: PushPayload }
  // версия новее, чем понимает этот notifier: строку не трогаем, её заберёт обновлённый
  | { ok: false; reason: 'unsupported_version' }
  | { ok: false; reason: 'invalid'; detail: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'

export function parsePayload(channel: string, raw: unknown): Parsed {
  if (!isRecord(raw)) return { ok: false, reason: 'invalid', detail: 'payload is not an object' }
  if (raw.v !== SUPPORTED_VERSION) {
    return typeof raw.v === 'number' && raw.v > SUPPORTED_VERSION
      ? { ok: false, reason: 'unsupported_version' }
      : { ok: false, reason: 'invalid', detail: 'bad version' }
  }

  if (channel === 'email') {
    const { kind, to, code, ttlMinutes } = raw
    if (kind !== 'code') return { ok: false, reason: 'invalid', detail: 'unknown email kind' }
    if (!isString(to) || !to.includes('@')) return { ok: false, reason: 'invalid', detail: 'bad recipient' }
    if (!isString(code) || !code) return { ok: false, reason: 'invalid', detail: 'bad code' }
    if (typeof ttlMinutes !== 'number' || !(ttlMinutes > 0)) return { ok: false, reason: 'invalid', detail: 'bad ttl' }
    return { ok: true, channel: 'email', payload: { v: 1, kind, to, code, ttlMinutes } }
  }

  if (channel === 'push') {
    const { subscriptionId, message } = raw
    if (!isString(subscriptionId) || !subscriptionId) return { ok: false, reason: 'invalid', detail: 'bad subscription' }
    if (!isRecord(message)) return { ok: false, reason: 'invalid', detail: 'bad message' }
    const { title, body, url, tag } = message
    if (!isString(title) || !isString(body) || !isString(url) || !isString(tag)) {
      return { ok: false, reason: 'invalid', detail: 'bad message fields' }
    }
    return { ok: true, channel: 'push', payload: { v: 1, subscriptionId, message: { title, body, url, tag } } }
  }

  return { ok: false, reason: 'invalid', detail: `unknown channel ${channel}` }
}
