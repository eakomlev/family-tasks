// Капча перед отправкой кода на почту. В приложении SmartCaptcha (она работает в браузере) пока не подключена: способ проверки
// выбираем отдельно (docs/mobile-app-plan.md, «Открытые вопросы», пункт 3). Пока токена нет, а сервер с включённой капчей
// ответит `captcha_required`; в разработке капча на сервере выключена (нет ключей SmartCaptcha в `.env`).
export async function getCaptchaToken(): Promise<string | undefined> {
  return undefined
}
