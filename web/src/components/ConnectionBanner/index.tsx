import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { request } from '@/api/client'
import { useConnectionLost } from '@/lib/connection'
import { RETRY_DELAY_MS } from '@/lib/retry'
import { api, TAGS } from '@/store/api'
import { Bar, Spinner } from './styles'

// «Соединение…» сверху, пока нет связи с сервером. Пока плашка видна, она сама проверяет связь каждые 2–3 секунды (лёгкий запрос
// `/api/health`), а когда связь вернулась, обновляет данные на экране.
export function ConnectionBanner() {
  const lost = useConnectionLost()
  const dispatch = useDispatch()
  const wasLost = useRef(false)

  useEffect(() => {
    if (!lost) {
      // связь вернулась: данные, которые не успели обновиться, запрашиваются заново
      if (wasLost.current) dispatch(api.util.invalidateTags([...TAGS]))
      wasLost.current = false
      return
    }
    wasLost.current = true
    let stopped = false
    // сам запрос сообщает о результате (request сообщает связь); ошибка здесь не важна
    const probe = () => void request('/health').catch(() => {})
    probe()
    const timer = setInterval(() => !stopped && probe(), RETRY_DELAY_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [lost, dispatch])

  if (!lost) return null
  return (
    <Bar role="status" aria-live="polite">
      <Spinner aria-hidden />
      Соединение…
    </Bar>
  )
}
