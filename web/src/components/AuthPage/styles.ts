import styled from 'styled-components'
import { Page } from '@/components/Page'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(60% 40% at 90% 8%, var(--auth-blob), transparent 70%),
    radial-gradient(50% 35% at 5% 95%, var(--auth-blob), transparent 70%),
    linear-gradient(160deg, var(--auth-a) 0%, var(--auth-b) 55%, var(--auth-c) 100%);
`

export const Content = styled(Page)`
  position: relative;
  z-index: 1;
`

// Карточка из «матового стекла» для форм поверх градиента
export const AuthCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--glass-edge);
  border-radius: 1.4rem;
  background: var(--auth-card);
  box-shadow: 0 12px 32px -16px var(--glass-shade);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
`

// Монета-логотип приложения
export const AuthLogo = styled.svg`
  width: var(--logo-size, 5.5rem);
  height: var(--logo-size, 5.5rem);
  filter: drop-shadow(0 10px 18px rgb(217 119 6 / 0.35));
`
