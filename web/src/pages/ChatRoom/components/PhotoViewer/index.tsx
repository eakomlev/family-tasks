import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { createPortal } from 'react-dom'
import { saveFile } from '@/lib/saveFile'
import { useInFlight } from '@/lib/useInFlight'
import { nextIndex, prevIndex } from '../../utils'
import { Arrow, IconButton, Overlay, SaveButton, Slide, Stage, Status, Track, TopBar } from './styles'
import type { PhotoViewerProps } from './types'

// Сколько длится плавная прокрутка кнопкой (запас к настоящей: браузеры анимируют 300–500 мс)
const SMOOTH_SCROLL_MS = 700

// Просмотр фото сообщения на весь экран. Фото лежат в одной горизонтальной ленте с привязкой к краям (scroll-snap): листается
// пальцем, как слайдер, следом за пальцем; есть кнопки и стрелки клавиатуры. «Сохранить» не уходит со страницы, закрыть можно
// крестиком, Escape и нажатием на фон.
export function PhotoViewer({ photos, index, onIndexChange, onClose }: PhotoViewerProps) {
  const guard = useInFlight()
  const close = useRef<HTMLButtonElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const count = photos.length

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

  // Открыли на нужном фото без анимации; позже кнопки и клавиши прокручивают ленту плавно, а палец уже сам её сдвинул.
  // Пока идёт наша плавная прокрутка, события прокрутки не читаем: на полпути лента «стоит» над соседним фото, и без этого
  // номер откатывался бы назад (кнопка «вперёд» и лента спорили бы друг с другом).
  const opened = useRef(false)
  const animating = useRef(false)
  const animationEnd = useRef<ReturnType<typeof setTimeout>>(undefined)
  useLayoutEffect(() => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const left = index * el.clientWidth
    if (Math.abs(el.scrollLeft - left) < 1) return
    const smooth = opened.current
    if (smooth) {
      animating.current = true
      clearTimeout(animationEnd.current)
      animationEnd.current = setTimeout(() => (animating.current = false), SMOOTH_SCROLL_MS)
    }
    el.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' })
    opened.current = true
  }, [index])
  useEffect(() => () => clearTimeout(animationEnd.current), [])

  if (!photos[index]) return null

  // лента остановилась на другом фото: сообщаем номер (во время прокрутки число меняется на полпути между фото)
  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (!el.clientWidth || animating.current) return
    const at = Math.round(el.scrollLeft / el.clientWidth)
    if (at !== index && at >= 0 && at < count) onIndexChange(at)
  }

  function go(to: number) {
    // с последнего на первое (и обратно) лента проматывается через все фото, поэтому там без анимации
    const far = Math.abs(to - index) > 1
    const el = track.current
    if (far && el) el.scrollTo({ left: to * el.clientWidth, behavior: 'instant' })
    onIndexChange(to)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    else if (count > 1 && e.key === 'ArrowRight') go(nextIndex(index, count))
    else if (count > 1 && e.key === 'ArrowLeft') go(prevIndex(index, count))
  }

  // два нажатия подряд до перерисовки запрашивают файл один раз
  const save = guard(async () => {
    setSaving(true)
    setSaveFailed(false)
    try {
      await saveFile(photos[index].fullUrl, `foto-${index + 1}.jpg`, 'image/jpeg')
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  })

  // в корень страницы: переписка лежит в слое с анимацией, из-за чего угол оболочки (баланс монет) оказывался бы поверх просмотра
  return createPortal(
    <Overlay role="dialog" aria-modal="true" aria-label="Просмотр фото" onKeyDown={onKeyDown}>
      <TopBar>
        <span aria-live="polite">{count > 1 ? `${index + 1} из ${count}` : ''}</span>
        <SaveButton type="button" aria-label="Сохранить фото" disabled={saving} onClick={() => void save()}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </SaveButton>
        <IconButton ref={close} type="button" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </IconButton>
      </TopBar>
      {saveFailed && <Status role="alert">Не удалось сохранить фото. Попробуйте ещё раз.</Status>}
      <Stage>
        <Track ref={track} role="group" aria-roledescription="карусель" aria-label="Фото" onScroll={onScroll}>
          {photos.map((photo, i) => (
            // нажатие на пустое место рядом с фото закрывает просмотр
            <Slide key={photo.id} onClick={(e) => e.target === e.currentTarget && onClose()}>
              {/* рядом с открытым грузим сразу, остальные по мере приближения */}
              <img
                src={photo.fullUrl}
                alt={`Фото ${i + 1}`}
                width={photo.width}
                height={photo.height}
                draggable={false}
                loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
              />
            </Slide>
          ))}
        </Track>
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
