import { useEffect } from 'react'
import { usePathname, useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'

// Невидимый приёмник «Поделиться» в оболочке вошедшего: как только приложению что-то передали (в том числе когда оно уже было открыто
// или человек вошёл после передачи), открывает экран выбора чата. При первом запуске по «Поделиться» туда ведёт `+native-intent`.
export function ShareReceiver() {
  const router = useRouter()
  const pathname = usePathname()
  const { sharedPayloads } = useIncomingShare()
  const waiting = sharedPayloads.length > 0

  useEffect(() => {
    if (waiting && pathname !== '/share') router.push('/share')
    // только когда появилось новое содержимое
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  return null
}
