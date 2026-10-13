import { createHmac } from 'node:crypto'

// Подпись ссылки на фото: тот же алгоритм у сервиса media (contracts/media-v1.json содержит контрольный пример для обоих).
// sig = hex(HMAC-SHA256(secret, семья/файл/срок)), срок в секундах Unix.
export function sign(secret: string, family: string, id: string, exp: number): string {
  return createHmac('sha256', secret).update(`${family}/${id}/${exp}`).digest('hex')
}

const DAY = 86400

// Срок подписи кратен суткам и лежит в пределах 24–48 часов от сейчас: адрес одного фото не меняется в течение суток,
// поэтому браузер кэширует картинку, а не качает заново при каждом обновлении ленты.
export function expiryFor(now: Date): number {
  return (Math.floor(now.getTime() / 1000 / DAY) + 2) * DAY
}
