import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

// сколько надо держать, чтобы считалось долгим нажатием, и на сколько можно сдвинуть палец (иначе это прокрутка)
const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10

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
      timer.current = setTimeout(() => {
        start.current = undefined
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
      callback.current?.()
    },
  }
}
