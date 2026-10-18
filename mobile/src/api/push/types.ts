export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
  // IANA-пояс устройства, например Europe/Moscow: по нему считаем 10:00 и 17:00
  timeZone: string
}

export interface PushTestResult {
  sent: number
  failed: number
}
