import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { ApiError } from '@/api/client'
import { API_URL } from '@/lib/config'
import { captchaHtml, parseCaptchaMessage } from '@/lib/captchaPage'
import { registerCaptchaRunner } from '@/lib/captcha'

// если окно с заданием закрыли, а токена нет, считаем проверку отменённой (успех приходит чуть раньше или позже закрытия)
const HIDDEN_GRACE_MS = 500
// страница или скрипт Яндекса не отозвались за это время: проверка недоступна
const LOAD_TIMEOUT_MS = 20_000

interface Run {
  siteKey: string
  resolve: (token: string) => void
  reject: (error: ApiError) => void
}

// Корневой компонент капчи: пока идёт проверка, держит невидимый WebView со страницей SmartCaptcha; если сервис показал задание,
// выводит его поверх экрана. Подключается один раз в корне приложения и регистрирует исполнителя для `getCaptchaToken`.
export function CaptchaHost() {
  const [run, setRun] = useState<Run | null>(null)
  const [visible, setVisible] = useState(false)
  const current = useRef<Run | null>(null)
  const hiddenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const finish = useCallback((done: (run: Run) => void) => {
    const active = current.current
    if (!active) return
    current.current = null
    clearTimeout(hiddenTimer.current)
    clearTimeout(loadTimer.current)
    setRun(null)
    setVisible(false)
    done(active)
  }, [])

  const fail = useCallback((code: 'captcha_cancelled' | 'captcha_unavailable') => finish((r) => r.reject(new ApiError(0, code))), [finish])

  useEffect(() => {
    registerCaptchaRunner(
      (siteKey) =>
        new Promise<string>((resolve, reject) => {
          const next = { siteKey, resolve, reject }
          current.current?.reject(new ApiError(0, 'captcha_cancelled'))
          current.current = next
          setVisible(false)
          setRun(next)
          clearTimeout(loadTimer.current)
          loadTimer.current = setTimeout(() => fail('captcha_unavailable'), LOAD_TIMEOUT_MS)
        }),
    )
    return () => {
      registerCaptchaRunner(undefined)
      clearTimeout(hiddenTimer.current)
      clearTimeout(loadTimer.current)
    }
  }, [fail])

  function onMessage(event: WebViewMessageEvent) {
    const message = parseCaptchaMessage(event.nativeEvent.data)
    if (!message) return
    if (message.type === 'success') finish((r) => r.resolve(message.token))
    else if (message.type === 'error') fail('captcha_unavailable')
    else if (message.type === 'visible') {
      // страница загрузилась и сервис показал задание: таймер ожидания загрузки больше не нужен
      clearTimeout(loadTimer.current)
      clearTimeout(hiddenTimer.current)
      setVisible(true)
    } else {
      setVisible(false)
      hiddenTimer.current = setTimeout(() => fail('captcha_cancelled'), HIDDEN_GRACE_MS)
    }
  }

  if (!run) return null

  return (
    // невидимый (размером в точку), пока сервис не показал задание; тогда поверх всего экрана на затемнении
    <View style={visible ? styles.overlay : styles.hidden} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={visible ? styles.card : styles.hidden}>
        <WebView
          key={run.siteKey}
          // адрес сайта как у страницы: ключ SmartCaptcha привязан к домену
          source={{ html: captchaHtml(run.siteKey), baseUrl: API_URL }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => fail('captcha_unavailable')}
          onHttpError={() => fail('captcha_unavailable')}
          style={styles.web}
          androidLayerType="hardware"
          accessibilityLabel="Проверка, что вы не робот"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,12,30,0.6)', padding: 16 },
  card: { width: '100%', maxWidth: 400, height: 420, borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  web: { flex: 1, backgroundColor: 'transparent' },
})
