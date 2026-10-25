import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ChatVideo } from '@/api'
import { CloseButton, Overlay, Player } from './styles'

// Просмотр видео на весь экран: плеер браузера (перемотка, звук, во весь экран), играет сразу. Видео отдаётся частями, поэтому
// начинает играть, не дожидаясь конца загрузки. Закрыть можно крестиком, Escape и нажатием на фон.
export function VideoViewer({ video, onClose }: { video: ChatVideo; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <Overlay role="dialog" aria-modal="true" aria-label="Просмотр видео" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <CloseButton ref={close} type="button" aria-label="Закрыть" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </CloseButton>
      {/* фон закрывает просмотр, а нажатия на сам плеер и кнопки нет */}
      <Player src={video.url} poster={video.thumbUrl} controls autoPlay playsInline />
    </Overlay>,
    document.body,
  )
}
