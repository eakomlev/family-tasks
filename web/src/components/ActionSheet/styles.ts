import styled from 'styled-components'

// панель у нижнего края поверх слегка затемнённой страницы (ниже окна подтверждения: оно открывается из меню)
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
  background: rgb(0 0 0 / 0.35);
  /* палец ещё на экране после долгого нажатия: меню не должно ничего выделять */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
`

export const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 26rem;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 1.2rem;
  background: var(--surface);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.35);
`

export const Heading = styled.p`
  margin: 0;
  padding: 0.5rem 0.8rem 0.4rem;
  color: var(--muted);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Item = styled.button<{ $danger?: boolean }>`
  padding: 0.85rem 0.8rem;
  border: 0;
  border-radius: 0.8rem;
  background: transparent;
  color: ${({ $danger }) => ($danger ? 'var(--error)' : 'var(--text)')};
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  @media (hover: hover) {
    &:hover {
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
  }

  &:disabled {
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

export const Message = styled.div`
  padding: 0 0.4rem 0.4rem;
`
