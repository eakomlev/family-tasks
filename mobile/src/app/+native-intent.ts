// Входящие ссылки до разбора маршрутов:
// - «Поделиться» из другого приложения запускает наше по ссылке с адресом expo-sharing: ведём её на экран выбора чата;
// - ссылка-приглашение с сайта (Android App Links: https://<домен>/join?code=…) приходит полным адресом, а маршруты у нас относительные:
//   оставляем путь и параметры, поэтому приложение открывается сразу на экране присоединения;
// - остальные ссылки (уведомления, переходы по схеме приложения familytasks://) остаются как есть.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path)
    if (url.hostname === 'expo-sharing') return '/share'
    if (url.protocol === 'https:' || url.protocol === 'http:') return `${url.pathname}${url.search}`
  } catch {
    /* относительный путь: не ссылка */
  }
  return path
}
