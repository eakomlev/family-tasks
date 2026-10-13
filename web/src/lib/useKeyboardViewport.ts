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
// onChange вызывается только при открытии или закрытии клавиатуры (например, чтобы прокрутить переписку вниз), а не
// на каждое микро-изменение видимой области: на мобильных браузерах resize visualViewport сыплется и от самого скролла
// страницы (сворачивается адресная строка), и вызов callback на каждый такой тик без разбора откатывал бы к низу любую
// ручную попытку прокрутки — независимо от того, открыта клавиатура или нет.
export function useKeyboardViewport(onChange?: () => void) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let open = false

    const apply = () => {
      root.style.setProperty('--vvh', `${vv.height}px`)
      root.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
      const next = window.innerHeight - vv.height > KEYBOARD_MIN_PX
      if (next === open) return
      open = next
      if (open) root.dataset.keyboard = ''
      else delete root.dataset.keyboard
      callback.current?.()
    }
    apply()
    vv.addEventListener('resize', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      root.style.removeProperty('--vvh')
      root.style.removeProperty('--keyboard-inset')
      delete root.dataset.keyboard
    }
  }, [])
}
