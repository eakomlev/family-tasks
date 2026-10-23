// «Поделиться» из другого приложения запускает наше по ссылке с адресом expo-sharing: ведём её на экран выбора чата,
// остальные ссылки (приглашения, уведомления, переходы по схеме приложения) остаются как есть.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') return '/share'
  } catch {
    /* относительный путь: не ссылка */
  }
  return path
}
