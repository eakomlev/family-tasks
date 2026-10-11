import styled from 'styled-components'

// всплывающее окно снизу поверх затемнённой страницы
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.5);
`

export const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 28rem;
  max-height: 92dvh;
  padding: 1.25rem 1rem calc(1rem + env(safe-area-inset-bottom));
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 1.2rem 1.2rem 0 0;
  background: var(--bg);

  h2 {
    margin: 0;
  }
`

export const Quote = styled.blockquote`
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--accent);
  border-radius: 0.3rem;
  background: var(--surface);
  color: var(--muted);
  overflow-wrap: anywhere;
`

export const Title = styled.span`
  font-weight: 600;
`

export const Emojis = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const Emoji = styled.button<{ $active: boolean }>`
  width: 2.8rem;
  height: 2.8rem;
  padding: 0;
  border: 2px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 0.8rem;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--accent) 18%, var(--surface))' : 'var(--surface)')};
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
