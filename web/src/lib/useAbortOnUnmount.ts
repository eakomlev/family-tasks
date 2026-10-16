import { useEffect, useRef } from 'react'

// AbortController на время жизни экрана: при уходе с него повторы чтения без связи (`retryRead`) прекращаются.
// Берите `ref.current?.signal` в момент запроса.
export function useAbortOnUnmount() {
  const ref = useRef<AbortController>(undefined)
  useEffect(() => {
    const controller = new AbortController()
    ref.current = controller
    return () => controller.abort()
  }, [])
  return ref
}
