import type { ReactNode } from 'react'

// Контурные значки пунктов меню профиля: рисуются цветом текста, как значки табов
const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
    {children}
  </svg>
)

// колокольчик: уведомления и звуки
export const BellIcon = () => (
  <Svg>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 21h4" />
  </Svg>
)

// палитра: оформление
export const PaletteIcon = () => (
  <Svg>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="10" cy="7.5" r="1" />
    <circle cx="14.5" cy="7.5" r="1" />
  </Svg>
)
