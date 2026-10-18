import { useEffect, useState } from 'react'

// текущее время, которое обновляется раз в интервал (по умолчанию раз в минуту)
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
