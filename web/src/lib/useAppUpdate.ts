import { useCallback, useEffect, useState } from 'react'

// как часто искать новую версию, пока приложение открыто
const CHECK_EVERY_MS = 30 * 60 * 1000

// Новая версия приложения: когда service worker заменили на свежий, а страница ещё работает на старой версии.
// ready = true, когда пора предложить обновление. Первую установку (раньше worker не управлял страницей) не считаем.
export function useAppUpdate() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    // worker уже управляет страницей: значит, смена управляющего это именно обновление
    const hadController = sw.controller !== null
    const onChange = () => {
      if (hadController) setReady(true)
    }
    sw.addEventListener('controllerchange', onChange)

    // сам браузер проверяет sw.js при открытии страницы; для долго открытого приложения проверяем сами
    const check = () => void sw.getRegistration().then((reg) => reg?.update()).catch(() => {})
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_EVERY_MS)

    return () => {
      sw.removeEventListener('controllerchange', onChange)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])

  const dismiss = useCallback(() => setReady(false), [])
  const reload = useCallback(() => window.location.reload(), [])
  return { ready, dismiss, reload }
}
