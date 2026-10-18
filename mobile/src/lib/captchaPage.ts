// Страница с виджетом Яндекс SmartCaptcha для WebView. Виджет невидимый: проверка запускается сразу, а если сервис сочтёт человека
// подозрительным, он сам покажет задание (приложение тогда выводит WebView на экран). Страница общается с приложением сообщениями
// JSON через ReactNativeWebView.postMessage: `visible` и `hidden` (окно с заданием), `success` с токеном, `error`.

export type CaptchaMessage = { type: 'visible' } | { type: 'hidden' } | { type: 'success'; token: string } | { type: 'error' }

// Страница открывается с адресом нашего сайта (baseUrl): ключ клиента SmartCaptcha привязан к списку разрешённых доменов
export function captchaHtml(siteKey: string): string {
  // ключ кладём в страницу как строку JSON (экранирует кавычки и «</script>»)
  const key = JSON.stringify(siteKey).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;padding:0;background:transparent}</style>
</head>
<body>
<div id="captcha"></div>
<script>
function send(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)) }
window.onSmartCaptchaReady = function () {
  try {
    var widget = window.smartCaptcha
    var id = widget.render(document.getElementById('captcha'), { sitekey: ${key}, invisible: true, hl: 'ru' })
    widget.subscribe(id, 'success', function (token) { send({ type: 'success', token: token }) })
    widget.subscribe(id, 'challenge-visible', function () { send({ type: 'visible' }) })
    widget.subscribe(id, 'challenge-hidden', function () { send({ type: 'hidden' }) })
    widget.subscribe(id, 'network-error', function () { send({ type: 'error' }) })
    widget.subscribe(id, 'javascript-error', function () { send({ type: 'error' }) })
    widget.execute(id)
  } catch (e) { send({ type: 'error' }) }
}
</script>
<script src="https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=onSmartCaptchaReady" async onerror="send({ type: 'error' })"></script>
</body>
</html>`
}

// Разбирает сообщение страницы; всё непонятное отбрасывается
export function parseCaptchaMessage(data: string): CaptchaMessage | null {
  let message: unknown
  try {
    message = JSON.parse(data)
  } catch {
    return null
  }
  if (!message || typeof message !== 'object') return null
  const { type, token } = message as { type?: unknown; token?: unknown }
  if (type === 'visible' || type === 'hidden' || type === 'error') return { type }
  if (type === 'success' && typeof token === 'string' && token !== '') return { type, token }
  return null
}
