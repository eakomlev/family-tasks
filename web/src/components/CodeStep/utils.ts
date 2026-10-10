export const RESEND_SECONDS = 60

export const CODE_LENGTH = 6

export const sanitizeCode = (value: string) => value.replace(/\D/g, '').slice(0, CODE_LENGTH)

export const isCompleteCode = (value: string) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value)
