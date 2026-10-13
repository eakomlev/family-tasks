import type { ReactNode } from 'react'
import { AuthLogo, Backdrop, Content } from './styles'

// Страница входа и регистрации: градиентный фон на весь экран и контент поверх него
// bare: без отступов и колонки (слайдер занимает экран сам)
export function AuthPage({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <>
      <Backdrop aria-hidden />
      {bare ? children : <Content>{children}</Content>}
    </>
  )
}

export { AuthCard } from './styles'

// Логотип: золотая монета с галочкой (как значок приложения)
export function AppLogo() {
  return (
    <AuthLogo viewBox="0 0 64 64" aria-hidden focusable="false">
      <circle cx="32" cy="32" r="29" fill="#fbbf24" stroke="#d97706" strokeWidth="4" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#d97706" strokeWidth="2.4" opacity="0.6" />
      <path d="m20 33 8 8 16-18" fill="none" stroke="#b45309" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </AuthLogo>
  )
}
