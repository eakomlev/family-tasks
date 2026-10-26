import styled, { css } from 'styled-components'

// Панель ввода парит над лентой, как в Telegram: сама прозрачная, фон не закрашен, а контент ленты под ней затемняется мягким градиентом
// (Feed получает нижний отступ по высоте панели, см. --composer-h, и прокручивается под неё). Room стоит на видимой области,
// поэтому панель всегда над клавиатурой.
export const Dock = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  padding: 0 1rem;

  /* затемнение ленты под панелью: плавно от прозрачного к фону, начинается чуть выше первой кнопки */
  &::before {
    content: '';
    position: absolute;
    inset: -1.8rem 0 0;
    z-index: -1;
    background: linear-gradient(to top, color-mix(in srgb, var(--bg) 92%, transparent) 55%, transparent);
    pointer-events: none;
  }
`

export const Bar = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0 calc(0.6rem + var(--tabbar-height));

  /* клавиатура открыта: индикатор «Домой» закрыт ею, отступ под него не нужен */
  :root[data-keyboard] & {
    padding-bottom: 0.6rem;
  }
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

// «стекло»: полупрозрачная заливка, размытие того, что под ней, тонкая светлая кромка и мягкая тень (как кнопки в Telegram)
const glass = css`
  background: color-mix(in srgb, var(--surface) 58%, transparent);
  border: 1px solid var(--glass-edge);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--glass-shade) 55%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
`

// скрепка: круглая стеклянная кнопка слева от поля
export const AttachButton = styled.button`
  ${glass}
  flex: none;
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  color: var(--text);
  cursor: pointer;

  svg {
    width: 1.45rem;
    height: 1.45rem;
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

// поле ввода: стеклянная таблетка, внутри справа значок эмодзи
export const Pill = styled.div`
  ${glass}
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  /* не ниже кнопок рядом: однострочное поле и кнопки одной высоты */
  min-height: 3rem;
  border-radius: 1.5rem;

  &:focus-within {
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  }
`

export const Field = styled.textarea`
  flex: 1;
  min-width: 0;
  max-height: 8rem;
  padding: 0.7rem 0 0.7rem 1rem;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  line-height: 1.35;
  resize: none;
  scrollbar-width: thin;

  &:focus-visible {
    outline: none;
  }

  &::placeholder {
    color: var(--muted);
  }
`

// значок эмодзи внутри поля
export const EmojiButton = styled.button`
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
    width: 1.45rem;
    height: 1.45rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover,
  &[aria-pressed='true'] {
    color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`

// отправить: круглая кнопка справа от поля; пока отправлять нечего, она приглушена
export const SendButton = styled.button`
  flex: none;
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 38%, transparent);
  cursor: pointer;
  transition: background 0.15s;

  svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:disabled {
    background: color-mix(in srgb, var(--accent) 45%, transparent);
    box-shadow: none;
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    backdrop-filter: blur(18px) saturate(180%);
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`

// выбранные файлы (не фото) над полем ввода: строка с именем, состоянием и кнопкой «убрать»
export const FileList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0 0 0.4rem;
  list-style: none;
`

export const FileChip = styled.li<{ $failed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  border: 1px solid ${({ $failed }) => ($failed ? 'var(--error)' : 'var(--border)')};
  border-radius: 0.8rem;
  background: var(--surface);
`

export const FileInfo = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;

  strong {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
    font-size: 0.75rem;
  }
`

export const FileRetry = styled.button`
  flex: none;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--accent);
  border-radius: 0.6rem;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
`

export const FileRemove = styled.button`
  flex: none;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  &:hover:not(:disabled) {
    background: var(--border);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

// над полем: на какое сообщение отвечаем или какое правим
export const ContextBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  div {
    flex: 1;
    min-width: 0;
    padding-left: 0.5rem;
    border-left: 3px solid var(--accent);
    font-size: 0.85rem;
  }

  strong {
    display: block;
    color: var(--accent);
  }

  span {
    display: block;
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 1.2rem;
    cursor: pointer;
  }
`
