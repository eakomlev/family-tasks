import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider } from 'react-redux'
import NetInfo from '@react-native-community/netinfo'
import { CaptchaHost } from '@/components/CaptchaHost'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { IdentityProvider } from '@/identity'
import { setNetworkAvailable } from '@/lib/connection'
import { store } from '@/store'
import { SessionSync } from '@/store/SessionSync'
import { FONT_ASSETS } from '@/theme/fonts'
import { ThemeProvider } from '@/theme'

SplashScreen.preventAutoHideAsync()

// Корень приложения: шрифт, хранилище данных, вход (токен из защищённого хранилища) и тема. Экраны делятся на группы
// `(auth)` для тех, кто не вошёл, и `(app)` для вошедших; группы сами перенаправляют друг на друга.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)

  // состояние сети нужно плашке «Соединение…» и повторам чтения
  useEffect(() => NetInfo.addEventListener((state) => setNetworkAvailable(state.isConnected !== false)), [])

  const ready = fontsLoaded || !!fontError
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])
  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <IdentityProvider>
              <SessionSync />
              <ConfirmProvider>
                <Stack screenOptions={{ headerShown: false }} />
                {/* проверка «я не робот» перед отправкой кода на почту (если включена на сервере) */}
                <CaptchaHost />
              </ConfirmProvider>
            </IdentityProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
