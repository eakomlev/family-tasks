import type { ReactNode } from 'react'
import { AuthPage } from '@/components/AuthPage'
import { BackLink } from '@/components/BackLink'
import { Doc } from './styles'

// Страница с юридическим текстом (политика, соглашение): открыта всем, без входа; читается как обычный документ
export function LegalDoc({ title, date, children }: { title: string; date: string; children: ReactNode }) {
  return (
    <AuthPage>
      <BackLink to="/">← Назад</BackLink>
      <Doc>
        <h1>{title}</h1>
        <p className="date">Редакция от {date}</p>
        {children}
      </Doc>
    </AuthPage>
  )
}
