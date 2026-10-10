import nodemailer from 'nodemailer'

// в dev по умолчанию Mailpit из docker-compose (localhost:1025)
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

const from = process.env.SMTP_FROM ?? 'Семейные задачи <noreply@family-tasks.local>'

export async function sendCode(to: string, code: string, ttlMinutes: number) {
  await transport.sendMail({
    from,
    to,
    subject: `Код для входа: ${code}`,
    text: `Ваш код для «Семейных задач»: ${code}\n\nОн действует ${ttlMinutes} минут. Если вы его не запрашивали, просто проигнорируйте это письмо.`,
  })
}
