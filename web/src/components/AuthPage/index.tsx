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

// Логотип: белый дом с галочкой на индиго (как значок приложения)
export function AppLogo() {
  return (
    <AuthLogo viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="14" fill="#4f46e5" />
      <path d="M32 15 13.25 30.75H20.25V47.75H43.75V30.75H50.75Z" fill="#fff" stroke="#fff" strokeWidth="5.5" strokeLinejoin="round" />
      <path d="M24.5 38.5 30 44 40.3 32.8" fill="none" stroke="#4f46e5" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" />
    </AuthLogo>
  )
}
