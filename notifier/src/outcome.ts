// Итог одной попытки отправки.
export type Outcome =
  | { kind: 'sent' }
  // временная ошибка: повторить позже (retryAfterSeconds, если провайдер попросил подождать)
  | { kind: 'retry'; error: string; retryAfterSeconds?: number }
  // постоянная ошибка: повторять бессмысленно, строка удаляется, неудача уходит в журнал
  | { kind: 'fail'; error: string }
  // отправлять уже некому (подписка удалена): строка удаляется без шума
  | { kind: 'skip'; reason: string }
  // лимит (скорость или дневной бюджет): вернуть строку без траты попытки и предложить снова через seconds
  | { kind: 'defer'; seconds: number; reason: string }
