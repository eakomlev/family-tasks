import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { nextIndex, prevIndex } from '../../utils'
import { Arrow, IconButton, Overlay, SaveLink, Stage, TopBar } from './styles'
import type { PhotoViewerProps } from './types'

// на сколько нужно сдвинуть палец по горизонтали, чтобы это считалось листанием
const SWIPE_PX = 50

// Просмотр фото сообщения на весь экран: листание кнопками, стрелками клавиатуры и жестом, «Сохранить», закрытие нажатием на фон или Escape.
export function PhotoViewer({ photos, index, onIndexChange, onClose }: PhotoViewerProps) {
  const close = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ x: number; y: number }>(undefined)
  const count = photos.length
  const photo = photos[index]

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  if (!photo) return null
  const go = (to: number) => onIndexChange(to)

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    else if (count > 1 && e.key === 'ArrowRight') go(nextIndex(index, count))
    else if (count > 1 && e.key === 'ArrowLeft') go(prevIndex(index, count))
  }

  function onPointerUp(e: PointerEvent) {
    const from = swipe.current
    swipe.current = undefined
    if (!from || count < 2) return
    const dx = e.clientX - from.x
    // горизонтальное движение заметно больше вертикального: иначе это обычная прокрутка или нажатие
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - from.y) * 1.5) go(dx < 0 ? nextIndex(index, count) : prevIndex(index, count))
  }

  // в корень страницы: переписка лежит в слое с анимацией, из-за чего угол оболочки (баланс монет) оказывался бы поверх просмотра
  return createPortal(
    <Overlay
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onKeyDown={onKeyDown}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={onPointerUp}
    >
      <TopBar>
        <span aria-live="polite">{count > 1 ? `${index + 1} из ${count}` : ''}</span>
        <SaveLink href={photo.fullUrl} download aria-label="Сохранить фото">
          Сохранить
        </SaveLink>
        <IconButton ref={close} type="button" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </IconButton>
      </TopBar>
      <Stage onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img key={photo.id} src={photo.fullUrl} alt={`Фото ${index + 1}`} width={photo.width} height={photo.height} draggable={false} />
        {count > 1 && (
          <>
            <Arrow $side="left" type="button" aria-label="Предыдущее фото" onClick={() => go(prevIndex(index, count))}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Arrow>
            <Arrow $side="right" type="button" aria-label="Следующее фото" onClick={() => go(nextIndex(index, count))}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Arrow>
          </>
        )}
      </Stage>
    </Overlay>,
    document.body,
  )
}
