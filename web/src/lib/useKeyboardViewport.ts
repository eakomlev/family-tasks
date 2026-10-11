import { useEffect, useRef } from 'react'

// насколько уменьшилась видимая область, чтобы считать, что открыта экранная клавиатура (пикселей)
const KEYBOARD_MIN_PX = 150

// Экранная клавиатура на телефоне. iOS не меняет размер страницы (innerHeight и dvh остаются прежними), меняется только
// видимая область visualViewport. Хук держит на корне страницы:
//   --vvh: высота видимой области в пикселях;
//   data-keyboard: атрибут, пока клавиатура открыта (стили прячут панель табов и прижимают поле ввода к низу).
// onChange вызывается при каждом изменении видимой области (например, чтобы прокрутить переписку вниз).
export function useKeyboardViewport(onChange?: () => void) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement

    const apply = () => {
      root.style.setProperty('--vvh', `${vv.height}px`)
      if (window.innerHeight - vv.height > KEYBOARD_MIN_PX) root.dataset.keyboard = ''
      else delete root.dataset.keyboard
      callback.current?.()
    }
    apply()
    vv.addEventListener('resize', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      root.style.removeProperty('--vvh')
      delete root.dataset.keyboard
    }
  }, [])
}
