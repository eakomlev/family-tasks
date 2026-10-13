import { useEffect, useRef } from 'react'

// насколько уменьшилась видимая область, чтобы считать, что открыта экранная клавиатура (пикселей)
const KEYBOARD_MIN_PX = 150

// Экранная клавиатура на телефоне. iOS не меняет размер страницы (innerHeight и dvh остаются прежними), меняется только
// видимая область visualViewport — а значит и position: sticky/fixed у элементов на странице продолжают мерить отступ
// от нижнего края ПРЕЖНЕГО (большого) слоя раскладки, который теперь скрыт под клавиатурой: элемент оказывается не на
// виду, а под клавиатурой, и попытка прокрутить страницу руками превращается в борьбу с Safari, который таскает
// страницу назад, чтобы вернуть в кадр то, что он считает видимым полем ввода. Хук держит на корне страницы:
//   --vvh: высота видимой области в пикселях;
//   --keyboard-inset: на сколько нижний край видимой области выше нижнего края слоя раскладки (0 без клавиатуры) —
//     этим отступом, а не sticky/fixed к слою раскладки, прижимают элемент к видимому низу экрана;
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
      root.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
      if (window.innerHeight - vv.height > KEYBOARD_MIN_PX) root.dataset.keyboard = ''
      else delete root.dataset.keyboard
      callback.current?.()
    }
    apply()
    // scroll видимой области (а не страницы): при наборе клавиатура может подрастать (панель подсказок), сдвигая offsetTop
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      root.style.removeProperty('--vvh')
      root.style.removeProperty('--keyboard-inset')
      delete root.dataset.keyboard
    }
  }, [])
}
