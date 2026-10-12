import styled, { keyframes } from 'styled-components'

const drop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-1rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
`

// вверху экрана, как системное уведомление: сверху ничего не прижато (внизу панель табов, кнопка «Новая задача», поле ввода чата); ниже окон подтверждения.
// Яркая акцентная плашка с отступом сверху, чтобы её нельзя было не заметить и она не липла к вырезу экрана.
export const Bar = styled.div`
  position: fixed;
  right: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  top: calc(env(safe-area-inset-top) + 1rem);
  left: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 0.9rem;
  border-radius: 1.1rem;
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.4);
  animation: ${drop} 0.3s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  p {
    flex: 1;
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.25;
  }
`

// светлая кнопка на акцентном фоне
export const Update = styled.button`
  flex: none;
  padding: 0.55rem 1rem;
  border: 0;
  border-radius: 0.8rem;
  background: var(--accent-text);
  color: var(--accent);
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }
`

export const Later = styled.button`
  flex: none;
  padding: 0.5rem 0.3rem;
  border: 0;
  background: none;
  color: var(--accent-text);
  font: inherit;
  opacity: 0.85;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }
`
