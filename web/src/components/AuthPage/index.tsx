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

// Иконка приложения на экранах входа и знакомства
export function AppLogo() {
  return <AuthLogo src="/icon.png" alt="" aria-hidden="true" />
}
