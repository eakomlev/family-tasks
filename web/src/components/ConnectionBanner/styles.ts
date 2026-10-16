import styled, { keyframes } from 'styled-components'

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

// тонкая полоса сверху: видна, пока нет связи с сервером; выше плашки обновления, ниже окон подтверждения
export const Bar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: calc(env(safe-area-inset-top) + 0.3rem) 1rem 0.3rem;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 0.85rem;
  font-weight: 600;
  pointer-events: none;
`

export const Spinner = styled.span`
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
