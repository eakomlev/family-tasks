import styled from 'styled-components'

export const Wrap = styled.div`
  position: relative;
  flex: none;
`

export const Trigger = styled.button`
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--track);
  color: var(--text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: currentColor;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// раскрывается под значком, по его правому краю
export const Menu = styled.div`
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 60;
  display: grid;
  width: max-content;
  min-width: 14rem;
  max-width: calc(100vw - 2rem);
  padding: 0.3rem;
  border: 1px solid var(--card-border, var(--border));
  border-radius: 1rem;
  background: var(--surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
`

export const Item = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.8rem;
  padding: 0 0.8rem;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: ${({ $danger }) => ($danger ? 'var(--error, #d33)' : 'var(--text)')};
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    outline: none;
  }

  &:disabled {
    opacity: 0.5;
  }
`

// флажок пункта-переключателя
export const Check = styled.span<{ $on: boolean }>`
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid ${({ $on }) => ($on ? 'var(--accent)' : 'var(--muted)')};
  border-radius: 0.3rem;
  background: ${({ $on }) => ($on ? 'var(--accent)' : 'transparent')};
  color: var(--accent-text);
  font-size: 0.8rem;
  line-height: 1;
`

export const Message = styled.div`
  padding: 0.3rem 0.5rem 0.5rem;
`
