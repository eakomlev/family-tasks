import { useEffect, useRef } from 'react'

// насколько уменьшилась видимая область, чтобы считать, что открыта экранная клавиатура (пикселей)
const KEYBOARD_MIN_PX = 150

// Экранная клавиатура на телефоне. iOS и Chrome на Android (по умолчанию) не меняют размер страницы, меняется только
// видимая область visualViewport; к тому же при фокусе поля браузер сдвигает её вниз по странице (offsetTop), чтобы
// поле оказалось на виду. Поэтому экран переписки не прокручивает страницу и не цепляется к её низу, а сам встаёт
// ровно на видимую область (position: fixed с top и height из переменных ниже), а прокручивается только лента внутри.
// Хук держит на корне страницы:
//   --vvh: высота видимой области в пикселях;
//   --vv-top: на сколько видимая область сдвинута вниз от верха слоя раскладки (0 без клавиатуры);
//   data-keyboard: атрибут, пока клавиатура открыта (стили прячут нижние отступы под индикатор «Домой»).
// Клавиатура определяется по наибольшей высоте видимой области при той же ширине экрана, а не по innerHeight:
// на части Android innerHeight уменьшается вместе с видимой областью, и разница с ним всегда около нуля.
// onChange вызывается только при открытии или закрытии клавиатуры, а не на каждое изменение видимой области
// (на мобильных браузерах resize сыплется и от сворачивания адресной строки).
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
    // наибольшая высота без клавиатуры для текущей ширины (поворот экрана сбрасывает её)
    let full = 0
    let width = vv.width

    const apply = () => {
      if (vv.width !== width) {
        width = vv.width
        full = 0
      }
      full = Math.max(full, vv.height, window.innerHeight)
      root.style.setProperty('--vvh', `${vv.height}px`)
      root.style.setProperty('--vv-top', `${Math.max(0, vv.offsetTop)}px`)
      const next = full - vv.height > KEYBOARD_MIN_PX
      if (next === open) return
      open = next
      if (open) root.dataset.keyboard = ''
      else delete root.dataset.keyboard
      callback.current?.()
    }
    apply()
    vv.addEventListener('resize', apply)
    // сдвиг видимой области без смены размера (iOS подтягивает поле ввода к клавиатуре) приходит событием scroll
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      root.style.removeProperty('--vvh')
      root.style.removeProperty('--vv-top')
      delete root.dataset.keyboard
    }
  }, [])
}
