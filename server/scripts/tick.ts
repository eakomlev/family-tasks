// Ручной запуск планировщика уведомлений для проверки, не дожидаясь 10:00 и 17:00.
//   npm run notify:tick -- 10:05          проход так, будто сегодня в вашем часовом поясе 10:05
//   npm run notify:tick -- 17:05 --reset  то же, но сначала очистить журнал отправленного (чтобы повторить)
// Подписки берутся из БД, поэтому уведомление уйдёт на устройства, где оно включено в «Настройках».
import { pool } from '../src/db.js'
import { runTick } from '../src/notifications/scheduler.js'

const args = process.argv.slice(2)
const time = args.find((a) => /^\d{1,2}:\d{2}$/.test(a))
const reset = args.includes('--reset')

const now = new Date()
if (time) {
  const [hours, minutes] = time.split(':').map(Number)
  now.setHours(hours, minutes, 0, 0)
}

if (reset) {
  await pool.query('delete from notification_log')
  console.log('Журнал отправленного очищен.')
}

console.log(`Проход планировщика для времени: ${now.toString()}`)
const { sent } = await runTick(now)
console.log(sent > 0 ? `Отправлено уведомлений: ${sent}` : 'Ничего не отправлено (нет подписок, не то время или уже отправлялось).')
await pool.end()
