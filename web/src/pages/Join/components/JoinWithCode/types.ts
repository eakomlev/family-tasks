export interface JoinWithCodeProps {
  code: string
}

export type InviteState = 'checking' | 'ok' | 'not_found' | 'expired' | 'error'
