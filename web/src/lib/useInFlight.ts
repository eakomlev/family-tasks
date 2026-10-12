import { useRef } from 'react'

// Защита от повторных нажатий: пока действие не закончилось, второй вызов любого из обёрнутых действий этого компонента игнорируется.
// В отличие от disabled от состояния React, работает и когда два нажатия приходят до перерисовки (двойной тап, быстрые Enter).
export function useInFlight() {
  const flying = useRef(false)
  return <A extends unknown[]>(action: (...args: A) => Promise<void>) =>
    async (...args: A): Promise<void> => {
      if (flying.current) return
      flying.current = true
      try {
        await action(...args)
      } finally {
        flying.current = false
      }
    }
}
