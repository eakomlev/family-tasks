import { useEffect, useRef } from 'react'
import { useAppUpdate } from '@/lib/useAppUpdate'
import { Bar, Later, Update } from './styles'

// Плашка «Доступна новая версия»: обновление ставится в фоне, а перезагрузить страницу пользователь решает сам.
// Пока она видна, её нижний край лежит в переменной --update-banner-bottom: другие верхние плашки (уведомления) встают ниже.
export function UpdateBanner() {
  const { ready, dismiss, reload } = useAppUpdate()
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bar.current
    const root = document.documentElement
    if (!ready || !el) return
    const publish = () => root.style.setProperty('--update-banner-bottom', `${Math.ceil(el.getBoundingClientRect().bottom)}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(publish)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--update-banner-bottom')
    }
  }, [ready])

  if (!ready) return null

  return (
    <Bar ref={bar} role="status">
      <p>Доступна новая версия приложения</p>
      <Update type="button" onClick={reload}>Обновить</Update>
      <Later type="button" onClick={dismiss} aria-label="Напомнить позже">Позже</Later>
    </Bar>
  )
}
