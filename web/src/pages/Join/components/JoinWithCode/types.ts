export interface JoinWithCodeProps {
  code: string
  // адрес из письма-приглашения
  email?: string
}

export type InviteState = 'checking' | 'ok' | 'not_found' | 'expired' | 'error'
