import styled from 'styled-components'

// компактное окно у нижнего края поверх слегка затемнённой страницы
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
  background: rgb(0 0 0 / 0.35);
  /* палец ещё на экране после долгого нажатия: окно не должно ничего выделять */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
`

export const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  max-width: 26rem;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 1.2rem;
  background: var(--surface);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.35);
`

// одна строка реакций
export const Emojis = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.15rem;
`

export const Emoji = styled.button<{ $active: boolean }>`
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0;
  border: 0;
  border-radius: 0.8rem;
  background: ${({ $active }) => ($active ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'transparent')};
  font-size: 1.6rem;
  line-height: 1.2;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:disabled {
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

export const Coins = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);

  small {
    padding: 0 0.3rem;
    color: var(--muted);
  }

  div {
    display: flex;
    gap: 0.35rem;
  }
`

export const CoinButton = styled.button`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.5rem 0;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:disabled {
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

// действия над сообщением: ответить, изменить, удалить
export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 0.3rem;
  border-top: 1px solid var(--border);
`

export const ActionButton = styled.button<{ $danger?: boolean }>`
  padding: 0.65rem 0.4rem;
  border: 0;
  background: none;
  color: ${({ $danger }) => ($danger ? 'var(--error, #d33)' : 'var(--text)')};
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`
