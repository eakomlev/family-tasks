import styled from 'styled-components'

// закрывает всю страницу, как окно подтверждения
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  overflow-y: auto;
  background: var(--bg);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.25rem;
  width: 100%;
  max-width: 28rem;
  text-align: center;

  h2 {
    margin: 0;
    font-size: 1.6rem;
  }

  p {
    margin: 0;
    color: var(--muted);
  }
`

export const Choices = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
`

export const Choice = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.7rem 0.1rem;
  border: 2px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 1rem;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface)')};
  color: var(--text);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  span:first-child {
    font-size: 2.2rem;
    line-height: 1;
  }

  span:last-child {
    font-size: 0.7rem;
    color: var(--muted);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
