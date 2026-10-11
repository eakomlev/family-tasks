import { useAppUpdate } from '@/lib/useAppUpdate'
import { Bar, Later, Update } from './styles'

// Плашка «Доступна новая версия»: обновление ставится в фоне, а перезагрузить страницу пользователь решает сам.
export function UpdateBanner() {
  const { ready, dismiss, reload } = useAppUpdate()
  if (!ready) return null

  return (
    <Bar role="status">
      <p>Доступна новая версия приложения</p>
      <Update type="button" onClick={reload}>Обновить</Update>
      <Later type="button" onClick={dismiss} aria-label="Напомнить позже">Позже</Later>
    </Bar>
  )
}
