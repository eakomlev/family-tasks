import nodemailer from 'nodemailer'
import type { CodeEmail, EmailPayload } from '../contract.js'
import type { Outcome } from '../outcome.js'

export interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>
}

// Тема и текст письма с кодом входа (как раньше в server/src/mail.ts).
export function renderCode({ code, ttlMinutes }: CodeEmail): { subject: string; text: string } {
  return {
    subject: `Код для входа: ${code}`,
    text: `Ваш код для входа в «Мою семью»: ${code}\n\nОн действует ${ttlMinutes} минут. Если вы его не запрашивали, просто проигнорируйте это письмо.`,
  }
}


// SMTP 5xx и неверный адрес получателя повторять бессмысленно, остальное (сеть, 4xx, таймауты) временное.
export function classifyMailError(err: unknown): Outcome {
  const e = err as { code?: string; responseCode?: number; message?: string }
  const error = [e.code, e.responseCode, e.message].filter((part) => part !== undefined && part !== '').join(' ')
  if (e.code === 'EENVELOPE' || (typeof e.responseCode === 'number' && e.responseCode >= 500)) return { kind: 'fail', error }
  return { kind: 'retry', error }
}

export function createMailProvider(transport: MailTransport, from: string) {
  return async (payload: EmailPayload): Promise<Outcome> => {
    try {
      await transport.sendMail({ from, to: payload.to, ...renderCode(payload) })
      return { kind: 'sent' }
    } catch (err) {
      return classifyMailError(err)
    }
  }
}

// В dev по умолчанию Mailpit из docker-compose (localhost:1025).
export function mailProviderFromEnv() {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return createMailProvider(transport, process.env.SMTP_FROM ?? 'Моя Семья <noreply@family-tasks.local>')
}
