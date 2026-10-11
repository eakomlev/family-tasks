import { Link } from 'react-router-dom'
import styled from 'styled-components'

// переменная нужна и панели табов, и содержимому, чтобы оно не пряталось под панелью
export const Root = styled.div`
  --tabbar-height: calc(3.75rem + env(safe-area-inset-bottom));
  position: relative;
`

export const Content = styled.div`
  padding-bottom: var(--tabbar-height);

  /* страница занимает экран минус панель табов, а не весь экран */
  > main {
    min-height: calc(100dvh - var(--tabbar-height));
  }

  /* открыта экранная клавиатура (чат): панели табов нет */
  :root[data-keyboard] & {
    padding-bottom: env(safe-area-inset-bottom);
  }
`

export const ProfileLink = styled(Link)`
  position: absolute;
  top: calc(0.75rem + env(safe-area-inset-top));
  right: 0.75rem;
  z-index: 5;
  border-radius: 50%;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`
