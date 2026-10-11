import styled from 'styled-components'

// прижата к панели табов, остаётся на виду при прокрутке переписки
export const Bar = styled.form`
  position: sticky;
  bottom: var(--tabbar-height);
  z-index: 5;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin: 0 -1rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg);

  /* клавиатура открыта: панели табов нет, поле ввода у самого низа */
  :root[data-keyboard] & {
    bottom: 0;
    padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
  }
`

export const Field = styled.textarea`
  flex: 1;
  min-width: 0;
  max-height: 8rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 1.2rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  resize: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

export const SendButton = styled.button`
  flex: none;
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  cursor: pointer;

  svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
