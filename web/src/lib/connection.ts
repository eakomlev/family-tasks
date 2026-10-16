import { useSyncExternalStore } from 'react'

// Состояние связи с сервером для плашки «Соединение…». Связи нет, если браузер сообщил `offline` или последний запрос не дошёл до
// сервера (сетевая ошибка, не ответ с кодом ошибки). Любой ответ сервера означает, что связь есть.
let offline = typeof navigator !== 'undefined' && navigator.onLine === false
let failing = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function reportNetworkFailure() {
  if (failing) return
  failing = true
  emit()
}

export function reportNetworkOk() {
  if (!failing && !offline) return
  failing = false
  offline = false
  emit()
}

export const isConnectionLost = () => offline || failing

// только для тестов: вернуть начальное состояние
export function resetConnection() {
  offline = false
  failing = false
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    offline = true
    emit()
  })
  // браузер сообщил о появлении сети; «failing» снимет первый удачный запрос (его делает плашка)
  window.addEventListener('online', () => {
    offline = false
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useConnectionLost(): boolean {
  return useSyncExternalStore(subscribe, isConnectionLost, () => false)
}
