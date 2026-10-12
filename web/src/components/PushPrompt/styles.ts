import styled from 'styled-components'

// сверху, ниже плашки обновления, если она на экране
export const Bar = styled.div`
  position: fixed;
  right: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  top: calc(var(--update-banner-bottom, calc(env(safe-area-inset-top) + 0.25rem)) + 0.75rem);
  left: max(0.75rem, calc((100vw - 28rem) / 2 + 0.75rem));
  z-index: 29;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 1.1rem;
  background: var(--surface);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.3);

  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.3;
  }

  small {
    color: var(--error);
  }
`

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

export const Enable = styled.button`
  flex: 1;
  padding: 0.6rem 1rem;
  border: 0;
  border-radius: 0.8rem;
  background: var(--accent);
  color: var(--accent-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
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
