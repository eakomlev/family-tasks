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

// Логотип: золотой контур дома с тёплым светом в двери на тёмном фоне (как значок приложения, рисунок из web/public/icon.svg в масштабе 1:8)
export function AppLogo() {
  return (
    <AuthLogo viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c2150" />
          <stop offset="1" stopColor="#07081c" />
        </linearGradient>
        <linearGradient id="logoGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset="1" stopColor="#d9922e" />
        </linearGradient>
        <radialGradient id="logoGlow" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="#ffcf70" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffcf70" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logoBg)" />
      <rect width="64" height="64" rx="14" fill="url(#logoGlow)" />
      <path
        d="M34.8 19.4Q32 17 29.2 19.4L16.7 30.2Q15.2 31.5 17.2 31.5L18.6 31.5Q19.8 31.5 19.8 32.7L19.8 42.6Q19.8 46.8 24.1 46.8L39.9 46.8Q44.2 46.8 44.2 42.6L44.2 32.7Q44.2 31.5 45.4 31.5L46.8 31.5Q48.8 31.5 47.3 30.2Z"
        fill="#0d1030"
        stroke="url(#logoGold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="27.4" y="34.9" width="9.2" height="12" rx="4.6" fill="#ffd477" />
    </AuthLogo>
  )
}
