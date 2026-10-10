import { createHash, randomBytes } from 'node:crypto'

// без похожих символов (0/o, 1/l/i), чтобы код можно было прочитать вслух
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function familyCode(length = 8): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export const inviteCode = () => randomBytes(16).toString('base64url')
export const memberToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
