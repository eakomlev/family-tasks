import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter, type Href } from 'expo-router'
import { routeFromNotificationData } from './route'
import { usePush } from './usePush'

// Пока приложение открыто, уведомления показываются сверху и в списке (без звука); о сообщениях открытого чата сервер уведомление не шлёт
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

// Невидимый компонент в оболочке вошедшего: переходы по нажатию на уведомление и тихая регистрация токена устройства при запуске.
export function NotificationsBridge() {
  const router = useRouter()
  // само подключение: при запуске токен регистрируется заново, если разрешение уже выдано
  usePush()

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null | undefined) => {
      const url = routeFromNotificationData(response?.notification.request.content.data)
      if (url) router.push(url as Href)
    }
    // приложение запущено нажатием на уведомление
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        open(last)
        Notifications.clearLastNotificationResponse()
      }
    })
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [router])

  return null
}
