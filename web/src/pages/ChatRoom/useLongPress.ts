import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

// сколько надо держать, чтобы считалось долгим нажатием, и на сколько можно сдвинуть палец (иначе это прокрутка)
const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10

// Пока палец удерживается (и недолго после срабатывания), браузер не должен начинать выделение текста.
const preventSelect = (e: Event) => e.preventDefault()
const SELECT_GUARD_MS = 800
let guardTimer: ReturnType<typeof setTimeout> | undefined
function blockSelection(on: boolean) {
  clearTimeout(guardTimer)
  if (on) {
    document.addEventListener('selectstart', preventSelect)
  } else {
    // выделение может начаться уже после срабатывания, поэтому защиту снимаем с небольшой задержкой
    guardTimer = setTimeout(() => document.removeEventListener('selectstart', preventSelect), SELECT_GUARD_MS)
  }
}

// Долгое нажатие как в мессенджерах: палец или мышь удерживаются, правая кнопка мыши и системное меню (Android) тоже срабатывают.
// Прокрутка, отпускание раньше времени и уход с элемента отменяют. Без обработчика возвращает пустой набор.
export function useLongPress(onTrigger?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<{ x: number; y: number }>(undefined)
  const callback = useRef(onTrigger)
  useEffect(() => {
    callback.current = onTrigger
  })

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    if (start.current) blockSelection(false)
    start.current = undefined
  }, [])
  useEffect(() => cancel, [cancel])

  if (!onTrigger) return {}
  return {
    onPointerDown: (e: PointerEvent) => {
      // правая кнопка открывает окно через contextmenu
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      clearTimeout(timer.current)
      blockSelection(true)
      timer.current = setTimeout(() => {
        start.current = undefined
        // выделение, если оно всё же началось, снимаем: вместо него открывается окно реакции
        window.getSelection()?.removeAllRanges()
        blockSelection(false)
        callback.current?.()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      const from = start.current
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      cancel()
      window.getSelection()?.removeAllRanges()
      callback.current?.()
    },
  }
}
