import styled from 'styled-components'

// вверху экрана, как системное уведомление: сверху ничего не прижато (внизу панель табов, кнопка «Новая задача», поле ввода чата); ниже окон подтверждения
export const Bar = styled.div`
  position: fixed;
  right: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  top: calc(env(safe-area-inset-top) + 0.5rem);
  left: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);

  p {
    flex: 1;
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.25;
  }
`

export const Update = styled.button`
  flex: none;
  padding: 0.5rem 0.9rem;
  border: 0;
  border-radius: 0.7rem;
  background: var(--accent);
  color: var(--accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`

export const Later = styled.button`
  flex: none;
  padding: 0.5rem 0.3rem;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
`
