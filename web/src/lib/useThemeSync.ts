import { useEffect } from 'react'
import { syncThemeColor } from './theme'

// при смене системной темы обновляем цвет строки состояния (в режиме «как в системе»)
export function useThemeSync() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', syncThemeColor)
    return () => query.removeEventListener('change', syncThemeColor)
  }, [])
}
