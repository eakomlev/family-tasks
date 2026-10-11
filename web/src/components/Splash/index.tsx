import { useEffect, useState } from 'react'
import { resetApp } from '@/lib/resetApp'
import { Box } from '../ErrorBoundary/styles'

// сколько ждём, прежде чем предложить сброс
const SLOW_MS = 8000

// Экран загрузки. Если она затянулась (например, у телефона завис доступ к IndexedDB), предлагает сброс вместо вечной пустоты.
export function Splash() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Box role="status" style={{ textAlign: 'center' }}>
      <p>Моя семья</p>
      <p>Загрузка…</p>
      {slow && (
        <>
          <p>Загрузка затянулась. Если ничего не меняется, сбросьте кэш: вход на этом устройстве сохранится.</p>
          <button type="button" onClick={() => void resetApp()}>Сбросить и перезагрузить</button>
        </>
      )}
    </Box>
  )
}
