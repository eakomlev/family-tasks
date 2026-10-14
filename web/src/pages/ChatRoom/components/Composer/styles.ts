import styled from 'styled-components'

// внизу экрана переписки (Room стоит на видимой области, поэтому поле ввода всегда над клавиатурой)
export const Bar = styled.form`
  flex: none;
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 -1rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--glass-bar);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
`

// поле, кнопки вложения и отправки в одну строку
export const Row = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
`

// выбранные фото над полем: лента с прокруткой вбок
export const Strip = styled.ul`
  display: flex;
  gap: 0.5rem;
  margin: 0;
  padding: 0.15rem 0.15rem 0.25rem;
  overflow-x: auto;
  list-style: none;
`

export const Thumb = styled.li<{ $failed: boolean }>`
  position: relative;
  flex: none;
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 0.8rem;
  border: 2px solid ${({ $failed }) => ($failed ? 'var(--error)' : 'transparent')};

  img {
    width: 100%;
    height: 100%;
    border-radius: 0.65rem;
    object-fit: cover;
  }
`

// затемнение и значок поверх превью, пока фото грузится или не загрузилось
export const ThumbState = styled.span<{ $failed?: boolean }>`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 0.65rem;
  background: rgb(0 0 0 / ${({ $failed }) => ($failed ? 0.55 : 0.35)});
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
`

export const ThumbRetry = styled.button`
  position: absolute;
  inset: 0;
  border: 0;
  border-radius: 0.65rem;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
`

export const ThumbRemove = styled.button`
  position: absolute;
  top: -0.4rem;
  right: -0.4rem;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: var(--text);
  color: var(--bg);
  cursor: pointer;

  svg {
    width: 0.7rem;
    height: 0.7rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`

export const AttachButton = styled.button`
  flex: none;
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover:not(:disabled) {
    color: var(--accent);
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
  scrollbar-width: thin;

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
